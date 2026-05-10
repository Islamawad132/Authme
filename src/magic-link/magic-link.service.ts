import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { EmailService } from '../email/email.service.js';
import type { RateLimitResult } from '../rate-limit/rate-limit.dto.js';

export interface MagicLinkRequestResult {
  success: boolean;
  message: string;
  rateLimit?: RateLimitResult;
}

export interface MagicLinkValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  realmId?: string;
  error?: string;
}

/** Default magic link expiry in seconds (10 minutes). */
const DEFAULT_MAGIC_LINK_EXPIRY_SECONDS = 600;

/** Magic link email subject. */
const DEFAULT_MAGIC_LINK_SUBJECT = 'Your Magic Sign-In Link — AuthMe';

/** Magic link email body template. */
const DEFAULT_MAGIC_LINK_BODY = `
<p>Click the link below to sign in to your account. This link expires in {{expiryMinutes}} minutes and can only be used once.</p>
<p>
  <a href="{{magicLinkUrl}}" style="display:inline-block;padding:10px 20px;background:{{primaryColor}};color:#fff;text-decoration:none;border-radius:6px;">
    Sign In
  </a>
</p>
<p style="color:#6b7280;font-size:0.875rem;">If you didn't request this, you can safely ignore this email. This link will expire soon.</p>
`;

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly rateLimit: RateLimitService,
    private readonly email: EmailService,
  ) {}

  /**
   * Request a magic link to be sent to the user's email.
   *
   * This method:
   * 1. Validates realm exists and magic link is enabled
   * 2. Finds user by email
   * 3. Checks rate limiting
   * 4. Creates magic link token and database record
   * 5. Sends email with magic link
   *
   * @param email - The email address to send the magic link to
   * @param realmId - The realm ID
   * @param ipAddress - Optional IP address for rate limiting
   * @param userAgent - Optional user agent for tracking
   * @param magicLinkUrl - The base URL for magic links (e.g., https://app.example.com/magic-link)
   * @returns Result indicating success or rate limit status
   */
  async requestMagicLink(
    email: string,
    realmId: string,
    ipAddress?: string,
    userAgent?: string,
    magicLinkUrl?: string,
  ): Promise<MagicLinkRequestResult> {
    // Get realm configuration
    const realm = await this.prisma.realm.findUnique({
      where: { id: realmId },
      select: {
        id: true,
        name: true,
        magicLinkEnabled: true,
        magicLinkExpirySeconds: true,
        magicLinkRateLimitPerEmail: true,
        magicLinkEmailSubject: true,
        magicLinkEmailTemplate: true,
        primaryColor: true,
      },
    });

    if (!realm) {
      return { success: false, message: 'Realm not found' };
    }

    if (!realm.magicLinkEnabled) {
      return { success: false, message: 'Magic link authentication is not enabled for this realm' };
    }

    // Find user by email in this realm
    const user = await this.prisma.user.findFirst({
      where: { realmId, email: email.toLowerCase() },
      select: { id: true, email: true, enabled: true },
    });

    if (!user) {
      // Don't reveal whether email exists - return success to prevent email enumeration
      this.logger.debug(`Magic link requested for unknown email in realm ${realm.name}: ${email}`);
      return { success: true, message: 'If an account exists with this email, a magic link has been sent' };
    }

    if (!user.enabled) {
      return { success: false, message: 'User account is disabled' };
    }

    // Check rate limiting
    const rateLimitResult = await this.checkRateLimit(realm.id, email, ipAddress);
    if (!rateLimitResult.allowed) {
      this.logger.warn(`Magic link rate limited for ${email} in realm ${realm.name}: ${JSON.stringify(rateLimitResult)}`);
      return {
        success: false,
        message: 'Too many requests. Please try again later.',
        rateLimit: rateLimitResult,
      };
    }

    // Generate magic link token
    const expirySeconds = realm.magicLinkExpirySeconds ?? DEFAULT_MAGIC_LINK_EXPIRY_SECONDS;
    const rawToken = this.crypto.generateSecret(32);
    const tokenHash = this.crypto.sha256(rawToken);

    // Create magic link request record
    await this.prisma.magicLinkRequest.create({
      data: {
        realmId: realm.id,
        userId: user.id,
        email: email.toLowerCase(),
        tokenHash,
        expiresAt: new Date(Date.now() + expirySeconds * 1000),
        ipAddress,
        userAgent,
      },
    });

    // Build magic link URL
    const baseUrl = magicLinkUrl ?? this.getMagicLinkBaseUrl();
    const magicLinkFullUrl = `${baseUrl}?token=${rawToken}&realm=${realm.name}`;

    // Send email
    const emailSubject = realm.magicLinkEmailSubject ?? DEFAULT_MAGIC_LINK_SUBJECT;
    const emailBody = this.buildMagicLinkEmailBody(
      realm.magicLinkEmailTemplate,
      magicLinkFullUrl,
      Math.ceil(expirySeconds / 60),
      realm.primaryColor ?? '#3b82f6',
    );

    await this.email.sendEmail(realm.name, email, emailSubject, emailBody);

    this.logger.log(`Magic link sent to ${email} for realm ${realm.name}`);

    return { success: true, message: 'Magic link sent successfully' };
  }

  /**
   * Validate a magic link token.
   *
   * This method:
   * 1. Hashes the token and looks up the record
   * 2. Validates the token is not expired
   * 3. Validates the token has not been used
   * 4. Marks the token as completed (one-time use)
   *
   * @param rawToken - The raw magic link token from the URL
   * @param realmName - Optional realm name to validate against
   * @returns Validation result with user info or error
   */
  async validateMagicLink(
    rawToken: string,
    realmName?: string,
  ): Promise<MagicLinkValidationResult> {
    const tokenHash = this.crypto.sha256(rawToken);

    const record = await this.prisma.magicLinkRequest.findUnique({
      where: { tokenHash },
      include: {
        realm: {
          select: { id: true, name: true, magicLinkEnabled: true },
        },
        user: {
          select: { id: true, email: true, enabled: true },
        },
      },
    });

    // Token not found
    if (!record) {
      this.logger.debug(`Magic link token not found: ${tokenHash.substring(0, 8)}...`);
      return { valid: false, error: 'Invalid or expired token' };
    }

    // Check realm magic link is enabled
    if (!record.realm.magicLinkEnabled) {
      return { valid: false, error: 'Magic link authentication is not enabled' };
    }

    // Check realm name if provided
    if (realmName && record.realm.name !== realmName) {
      return { valid: false, error: 'Invalid realm' };
    }

    // Check user is still enabled
    if (!record.user.enabled) {
      return { valid: false, error: 'User account is disabled' };
    }

    // Check if already completed
    if (record.status === 'COMPLETED') {
      return { valid: false, error: 'This link has already been used' };
    }

    // Check if cancelled
    if (record.status === 'CANCELLED') {
      return { valid: false, error: 'This link has been cancelled' };
    }

    // Check if expired
    if (record.expiresAt < new Date() || record.status === 'EXPIRED') {
      // Update status to EXPIRED if not already
      if (record.status !== 'EXPIRED') {
        await this.prisma.magicLinkRequest.update({
          where: { id: record.id },
          data: { status: 'EXPIRED' },
        });
      }
      return { valid: false, error: 'This link has expired' };
    }

    // Mark as completed (one-time use enforcement)
    await this.prisma.magicLinkRequest.update({
      where: { id: record.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Magic link validated for user ${record.user.id} in realm ${record.realm.name}`);

    return {
      valid: true,
      userId: record.user.id,
      email: record.user.email ?? undefined,
      realmId: record.realm.id,
    };
  }

  /**
   * Cancel all pending magic link requests for a user.
   * Useful when a user changes their password or reports a compromised account.
   */
  async cancelPendingRequests(userId: string, realmId: string): Promise<number> {
    const result = await this.prisma.magicLinkRequest.updateMany({
      where: {
        userId,
        realmId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    return result.count;
  }

  /**
   * Clean up expired magic link requests.
   * Should be called periodically to prevent database bloat.
   */
  async cleanupExpiredRequests(): Promise<number> {
    const result = await this.prisma.magicLinkRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired magic link requests`);
    }

    return result.count;
  }

  /**
   * Check rate limit for magic link requests.
   * Uses IP-based limiting if available, otherwise falls back to email-only limiting.
   */
  private async checkRateLimit(
    realmId: string,
    email: string,
    ipAddress?: string,
  ): Promise<RateLimitResult> {
    // Use IP-based rate limiting if available
    if (ipAddress) {
      const ipLimit = await this.rateLimit.checkIpLimit(ipAddress, realmId);
      if (!ipLimit.allowed) {
        return ipLimit;
      }
    }

    // Get realm rate limit config
    const realm = await this.prisma.realm.findUnique({
      where: { id: realmId },
      select: { magicLinkRateLimitPerEmail: true },
    });

    const limitPerWindow = realm?.magicLinkRateLimitPerEmail ?? 5;

    // Check email-based rate limit in database
    // Count recent pending requests for this email in the last 15 minutes (default window)
    const windowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await this.prisma.magicLinkRequest.count({
      where: {
        email: email.toLowerCase(),
        realmId,
        status: 'PENDING',
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= limitPerWindow) {
      return {
        allowed: false,
        limit: limitPerWindow,
        remaining: 0,
        resetAt: Math.ceil((Date.now() + 15 * 60 * 1000) / 1000),
        retryAfter: 15 * 60,
      };
    }

    return {
      allowed: true,
      limit: limitPerWindow,
      remaining: limitPerWindow - recentCount - 1,
      resetAt: Math.ceil((Date.now() + 15 * 60 * 1000) / 1000),
    };
  }

  /**
   * Get the base URL for magic links from environment or fallback.
   */
  private getMagicLinkBaseUrl(): string {
    return process.env['MAGIC_LINK_BASE_URL'] ?? 'http://localhost:5173/magic-link';
  }

  /**
   * Build the magic link email body from template or default.
   */
  private buildMagicLinkEmailBody(
    template: string | null | undefined,
    magicLinkUrl: string,
    expiryMinutes: number,
    primaryColor: string,
  ): string {
    if (template) {
      return template
        .replace(/\{\{magicLinkUrl\}\}/g, magicLinkUrl)
        .replace(/\{\{expiryMinutes\}\}/g, String(expiryMinutes))
        .replace(/\{\{primaryColor\}\}/g, primaryColor);
    }

    return DEFAULT_MAGIC_LINK_BODY
      .replace(/\{\{magicLinkUrl\}\}/g, magicLinkUrl)
      .replace(/\{\{expiryMinutes\}\}/g, String(expiryMinutes))
      .replace(/\{\{primaryColor\}\}/g, primaryColor);
  }
}

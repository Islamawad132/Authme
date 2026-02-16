import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { VerificationService } from '../verification/verification.service.js';
import { EmailService } from '../email/email.service.js';
import { PasswordPolicyService } from '../password-policy/password-policy.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { Realm } from '@prisma/client';

const USER_SELECT = {
  id: true,
  realmId: true,
  username: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly verificationService: VerificationService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async create(realm: Realm, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username: dto.username } },
    });
    if (existing) {
      throw new ConflictException(`User '${dto.username}' already exists in realm '${realm.name}'`);
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      // Validate password against realm policy
      const validation = this.passwordPolicyService.validate(realm, dto.password);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join('. '));
      }

      passwordHash = await this.crypto.hashPassword(dto.password);
    }

    const user = await this.prisma.user.create({
      data: {
        realmId: realm.id,
        username: dto.username,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        enabled: dto.enabled,
        passwordHash,
        passwordChangedAt: passwordHash ? new Date() : undefined,
      },
      select: USER_SELECT,
    });

    // Record password history
    if (passwordHash && realm.passwordHistoryCount > 0) {
      await this.passwordPolicyService.recordHistory(
        user.id, realm.id, passwordHash, realm.passwordHistoryCount,
      );
    }

    // Send verification email if user has email and SMTP is configured
    if (user.email) {
      this.sendVerificationEmail(realm.name, user.id, user.email).catch((err) => {
        this.logger.warn(`Failed to send verification email: ${err.message}`);
      });
    }

    return user;
  }

  async sendVerificationEmail(realmName: string, userId: string, email: string) {
    const configured = await this.emailService.isConfigured(realmName);
    if (!configured) return;

    const rawToken = await this.verificationService.createToken(userId, 'email_verification', 86400);
    const baseUrl = this.config.get<string>('BASE_URL', 'http://localhost:3000');
    const verifyUrl = `${baseUrl}/realms/${realmName}/verify-email?token=${rawToken}`;

    await this.emailService.sendEmail(
      realmName,
      email,
      'Verify Your Email — AuthMe',
      `<h2>Verify Your Email</h2>
      <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p style="color:#6b7280;font-size:0.875rem;">If you didn't create an account, you can safely ignore this email.</p>`,
    );
  }

  async findAll(realm: Realm, skip: number, take: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { realmId: realm.id },
        select: USER_SELECT,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({ where: { realmId: realm.id } }),
    ]);
    return { users, total };
  }

  async findById(realm: Realm, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, realmId: realm.id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user;
  }

  async update(realm: Realm, userId: string, dto: UpdateUserDto) {
    await this.findById(realm, userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        enabled: dto.enabled,
        emailVerified: dto.emailVerified,
      },
      select: USER_SELECT,
    });
  }

  async remove(realm: Realm, userId: string) {
    await this.findById(realm, userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async setPassword(realm: Realm, userId: string, password: string) {
    await this.findById(realm, userId);

    // Validate against realm password policy
    const validation = this.passwordPolicyService.validate(realm, password);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('. '));
    }

    // Check password history
    if (realm.passwordHistoryCount > 0) {
      const inHistory = await this.passwordPolicyService.checkHistory(
        userId, realm.id, password, realm.passwordHistoryCount,
      );
      if (inHistory) {
        throw new BadRequestException('Password was used recently. Choose a different password.');
      }
    }

    const passwordHash = await this.crypto.hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Record password history
    await this.passwordPolicyService.recordHistory(
      userId, realm.id, passwordHash, realm.passwordHistoryCount,
    );
  }

  async getOfflineSessions(realm: Realm, userId: string) {
    await this.findById(realm, userId);
    const tokens = await this.prisma.refreshToken.findMany({
      where: { session: { userId }, isOffline: true, revoked: false },
      include: { session: { select: { id: true, userId: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((t) => ({
      id: t.id,
      sessionId: t.session.id,
      sessionStarted: t.session.createdAt,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }));
  }

  async revokeOfflineSession(realm: Realm, userId: string, tokenId: string) {
    await this.findById(realm, userId);
    const token = await this.prisma.refreshToken.findFirst({
      where: { id: tokenId, session: { userId }, isOffline: true },
    });
    if (!token) {
      throw new NotFoundException('Offline session not found');
    }
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });
  }
}

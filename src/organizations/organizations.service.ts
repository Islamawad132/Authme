import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { promises as dns } from 'dns';
import { randomBytes, createHash } from 'crypto';
import type { Realm } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateSsoConnectionDto } from './dto/create-sso-connection.dto.js';
import { UpdateSsoConnectionDto } from './dto/update-sso-connection.dto.js';
import { VerifyDomainDto } from './dto/verify-domain.dto.js';

/** TTL for invitation tokens in milliseconds (72 h). */
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

/** Prefix embedded in every DNS TXT verification value. */
const DNS_TXT_PREFIX = 'authme-domain-verification=';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Organizations CRUD ──────────────────────────────────

  async create(realm: Realm, dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { realmId_slug: { realmId: realm.id, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(
        `Organization with slug '${dto.slug}' already exists in this realm`,
      );
    }

    return this.prisma.organization.create({
      data: {
        realmId: realm.id,
        slug: dto.slug,
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        enabled: dto.enabled ?? true,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        requireMfa: dto.requireMfa ?? false,
        verifiedDomains: [],
      },
    });
  }

  async findAll(realm: Realm) {
    return this.prisma.organization.findMany({
      where: { realmId: realm.id },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(realm: Realm, slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { realmId_slug: { realmId: realm.id, slug } },
    });
    if (!org) {
      throw new NotFoundException(`Organization '${slug}' not found`);
    }
    return org;
  }

  async update(realm: Realm, slug: string, dto: UpdateOrganizationDto) {
    await this.findOne(realm, slug);

    return this.prisma.organization.update({
      where: { realmId_slug: { realmId: realm.id, slug } },
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        enabled: dto.enabled,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        requireMfa: dto.requireMfa,
      },
    });
  }

  async remove(realm: Realm, slug: string) {
    await this.findOne(realm, slug);
    return this.prisma.organization.delete({
      where: { realmId_slug: { realmId: realm.id, slug } },
    });
  }

  // ─── Member Management ───────────────────────────────────

  async addMember(realm: Realm, slug: string, dto: AddMemberDto) {
    const org = await this.findOne(realm, slug);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, realmId: realm.id },
    });
    if (!user) {
      throw new NotFoundException(`User '${dto.userId}' not found in realm`);
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: dto.userId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    return this.prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: dto.userId,
        role: dto.role ?? 'member',
      },
    });
  }

  async listMembers(realm: Realm, slug: string) {
    const org = await this.findOne(realm, slug);
    return this.prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateMemberRole(
    realm: Realm,
    slug: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const org = await this.findOne(realm, slug);

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: org.id, userId },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found in organization');
    }

    return this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { role: dto.role },
    });
  }

  async removeMember(realm: Realm, slug: string, userId: string) {
    const org = await this.findOne(realm, slug);

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: org.id, userId },
      },
    });
    if (!member) {
      throw new NotFoundException('Member not found in organization');
    }

    return this.prisma.organizationMember.delete({ where: { id: member.id } });
  }

  // ─── Invitations ─────────────────────────────────────────

  async createInvitation(realm: Realm, slug: string, dto: CreateInvitationDto) {
    const org = await this.findOne(realm, slug);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    return this.prisma.organizationInvitation.create({
      data: {
        organizationId: org.id,
        email: dto.email.toLowerCase(),
        role: dto.role ?? 'member',
        token,
        expiresAt,
      },
    });
  }

  async acceptInvitation(realm: Realm, slug: string, token: string, userId: string) {
    const org = await this.findOne(realm, slug);

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.organizationId !== org.id) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt) {
      throw new GoneException('Invitation has already been accepted');
    }
    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, realmId: realm.id },
    });
    if (!user) {
      throw new NotFoundException('User not found in realm');
    }

    if (user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException(
        'This invitation was issued to a different email address',
      );
    }

    // Mark accepted and add member in a single transaction.
    const [, member] = await this.prisma.$transaction([
      this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      this.prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId,
          },
        },
        create: {
          organizationId: org.id,
          userId,
          role: invitation.role,
        },
        update: {},
      }),
    ]);

    return member;
  }

  async listInvitations(realm: Realm, slug: string) {
    const org = await this.findOne(realm, slug);
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Domain Verification ─────────────────────────────────

  /**
   * Returns the DNS TXT record value that the customer must publish under
   * `_authme-challenge.<domain>` to prove domain ownership.
   *
   * The value is deterministic per (organizationId, domain) so calling this
   * endpoint multiple times always returns the same token.
   */
  generateDomainVerificationToken(organizationId: string, domain: string): string {
    const hash = createHash('sha256')
      .update(`${organizationId}:${domain}`)
      .digest('hex')
      .slice(0, 32);
    return `${DNS_TXT_PREFIX}${hash}`;
  }

  async initiateDomainVerification(realm: Realm, slug: string, dto: VerifyDomainDto) {
    const org = await this.findOne(realm, slug);
    const domain = dto.domain.toLowerCase();
    const txtValue = this.generateDomainVerificationToken(org.id, domain);

    return {
      domain,
      txtRecord: `_authme-challenge.${domain}`,
      txtValue,
      message:
        `Add the following DNS TXT record to your domain, then call the verify endpoint.`,
    };
  }

  async verifyDomain(realm: Realm, slug: string, dto: VerifyDomainDto) {
    const org = await this.findOne(realm, slug);
    const domain = dto.domain.toLowerCase();

    if (org.verifiedDomains.includes(domain)) {
      return { domain, verified: true, alreadyVerified: true };
    }

    const expectedTxt = this.generateDomainVerificationToken(org.id, domain);
    const txtHost = `_authme-challenge.${domain}`;

    let records: string[][] = [];
    try {
      records = await dns.resolveTxt(txtHost);
    } catch {
      throw new BadRequestException(
        `DNS TXT lookup for '${txtHost}' failed. ` +
          'Make sure the record has been published and DNS has propagated.',
      );
    }

    const flat = records.flat();
    const found = flat.some((v) => v === expectedTxt);
    if (!found) {
      throw new BadRequestException(
        `DNS TXT record not found or value mismatch for '${txtHost}'.`,
      );
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { verifiedDomains: { push: domain } },
    });

    return { domain, verified: true };
  }

  // ─── Auto-assign by email domain ─────────────────────────

  /**
   * Called after a user registers in a realm.  Finds any organization in that
   * realm whose verified domains contain the user's email domain and auto-adds
   * the user as a member.
   */
  async autoAssignUserByEmailDomain(realmId: string, userId: string, email: string) {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) return;

    const orgs = await this.prisma.organization.findMany({
      where: {
        realmId,
        enabled: true,
        verifiedDomains: { has: emailDomain },
      },
    });

    for (const org of orgs) {
      await this.prisma.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: org.id, userId },
        },
        create: { organizationId: org.id, userId, role: 'member' },
        update: {},
      });
    }
  }

  // ─── SSO Connections ─────────────────────────────────────

  async createSsoConnection(
    realm: Realm,
    slug: string,
    dto: CreateSsoConnectionDto,
  ) {
    const org = await this.findOne(realm, slug);

    return this.prisma.organizationSsoConnection.create({
      data: {
        organizationId: org.id,
        type: dto.type,
        name: dto.name,
        enabled: dto.enabled ?? true,
        config: dto.config as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listSsoConnections(realm: Realm, slug: string) {
    const org = await this.findOne(realm, slug);
    return this.prisma.organizationSsoConnection.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSsoConnection(realm: Realm, slug: string, connectionId: string) {
    const org = await this.findOne(realm, slug);
    const conn = await this.prisma.organizationSsoConnection.findFirst({
      where: { id: connectionId, organizationId: org.id },
    });
    if (!conn) {
      throw new NotFoundException(`SSO connection '${connectionId}' not found`);
    }
    return conn;
  }

  async updateSsoConnection(
    realm: Realm,
    slug: string,
    connectionId: string,
    dto: UpdateSsoConnectionDto,
  ) {
    const conn = await this.getSsoConnection(realm, slug, connectionId);

    return this.prisma.organizationSsoConnection.update({
      where: { id: conn.id },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        config: dto.config !== undefined ? (dto.config as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async deleteSsoConnection(realm: Realm, slug: string, connectionId: string) {
    const conn = await this.getSsoConnection(realm, slug, connectionId);
    return this.prisma.organizationSsoConnection.delete({ where: { id: conn.id } });
  }
}

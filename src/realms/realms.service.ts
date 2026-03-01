import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwkService } from '../crypto/jwk.service.js';
import { ScopeSeedService } from '../scopes/scope-seed.service.js';
import { ThemeService } from '../theme/theme.service.js';
import { CreateRealmDto } from './dto/create-realm.dto.js';
import { UpdateRealmDto } from './dto/update-realm.dto.js';

@Injectable()
export class RealmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwkService: JwkService,
    private readonly scopeSeedService: ScopeSeedService,
    private readonly themeService: ThemeService,
  ) {}

  private redactSmtpPassword(realm: any) {
    if (realm && realm.smtpPassword) {
      return { ...realm, smtpPassword: '••••••' };
    }
    return realm;
  }

  async create(dto: CreateRealmDto) {
    const existing = await this.prisma.realm.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Realm '${dto.name}' already exists`);
    }

    const keyPair = await this.jwkService.generateRsaKeyPair();

    const realm = await this.prisma.realm.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        enabled: dto.enabled,
        accessTokenLifespan: dto.accessTokenLifespan,
        refreshTokenLifespan: dto.refreshTokenLifespan,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser,
        smtpPassword: dto.smtpPassword,
        smtpFrom: dto.smtpFrom,
        smtpSecure: dto.smtpSecure,
        passwordMinLength: dto.passwordMinLength,
        passwordRequireUppercase: dto.passwordRequireUppercase,
        passwordRequireLowercase: dto.passwordRequireLowercase,
        passwordRequireDigits: dto.passwordRequireDigits,
        passwordRequireSpecialChars: dto.passwordRequireSpecialChars,
        passwordHistoryCount: dto.passwordHistoryCount,
        passwordMaxAgeDays: dto.passwordMaxAgeDays,
        bruteForceEnabled: dto.bruteForceEnabled,
        maxLoginFailures: dto.maxLoginFailures,
        lockoutDuration: dto.lockoutDuration,
        failureResetTime: dto.failureResetTime,
        permanentLockoutAfter: dto.permanentLockoutAfter,
        registrationAllowed: dto.registrationAllowed,
        mfaRequired: dto.mfaRequired,
        offlineTokenLifespan: dto.offlineTokenLifespan,
        eventsEnabled: dto.eventsEnabled,
        eventsExpiration: dto.eventsExpiration,
        adminEventsEnabled: dto.adminEventsEnabled,
        themeName: dto.themeName,
        theme: dto.theme as any,
        loginTheme: dto.loginTheme,
        accountTheme: dto.accountTheme,
        emailTheme: dto.emailTheme,
        signingKeys: {
          create: {
            kid: keyPair.kid,
            algorithm: 'RS256',
            publicKey: keyPair.publicKeyPem,
            privateKey: keyPair.privateKeyPem,
          },
        },
      },
    });

    // Seed default scopes for the new realm
    await this.scopeSeedService.seedDefaultScopes(realm.id);

    return this.redactSmtpPassword(realm);
  }

  async findAll() {
    const realms = await this.prisma.realm.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return realms.map((r) => this.redactSmtpPassword(r));
  }

  async findByName(name: string) {
    const realm = await this.prisma.realm.findUnique({
      where: { name },
    });
    if (!realm) {
      throw new NotFoundException(`Realm '${name}' not found`);
    }
    return this.redactSmtpPassword(realm);
  }

  async findByNameRaw(name: string) {
    const realm = await this.prisma.realm.findUnique({
      where: { name },
    });
    if (!realm) {
      throw new NotFoundException(`Realm '${name}' not found`);
    }
    return realm;
  }

  async update(name: string, dto: UpdateRealmDto) {
    await this.findByNameRaw(name);

    // Validate theme names against available themes
    const themeFields = [dto.loginTheme, dto.accountTheme, dto.emailTheme, dto.themeName].filter(Boolean);
    if (themeFields.length > 0) {
      const availableNames = this.themeService.getAvailableThemes().map(t => t.name);
      for (const themeName of themeFields) {
        if (!availableNames.includes(themeName!)) {
          throw new BadRequestException(
            `Theme '${themeName}' does not exist. Available themes: ${availableNames.join(', ')}`,
          );
        }
      }
    }

    const data: any = {
      displayName: dto.displayName,
      enabled: dto.enabled,
      accessTokenLifespan: dto.accessTokenLifespan,
      refreshTokenLifespan: dto.refreshTokenLifespan,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpUser: dto.smtpUser,
      smtpFrom: dto.smtpFrom,
      smtpSecure: dto.smtpSecure,
      passwordMinLength: dto.passwordMinLength,
      passwordRequireUppercase: dto.passwordRequireUppercase,
      passwordRequireLowercase: dto.passwordRequireLowercase,
      passwordRequireDigits: dto.passwordRequireDigits,
      passwordRequireSpecialChars: dto.passwordRequireSpecialChars,
      passwordHistoryCount: dto.passwordHistoryCount,
      passwordMaxAgeDays: dto.passwordMaxAgeDays,
      bruteForceEnabled: dto.bruteForceEnabled,
      maxLoginFailures: dto.maxLoginFailures,
      lockoutDuration: dto.lockoutDuration,
      failureResetTime: dto.failureResetTime,
      permanentLockoutAfter: dto.permanentLockoutAfter,
      registrationAllowed: dto.registrationAllowed,
      mfaRequired: dto.mfaRequired,
      offlineTokenLifespan: dto.offlineTokenLifespan,
      eventsEnabled: dto.eventsEnabled,
      eventsExpiration: dto.eventsExpiration,
      adminEventsEnabled: dto.adminEventsEnabled,
      themeName: dto.themeName,
      theme: dto.theme as any,
      loginTheme: dto.loginTheme,
      accountTheme: dto.accountTheme,
      emailTheme: dto.emailTheme,
    };

    // Only update password if a real value is provided (not the redacted placeholder)
    if (dto.smtpPassword && dto.smtpPassword !== '••••••') {
      data.smtpPassword = dto.smtpPassword;
    }

    const realm = await this.prisma.realm.update({
      where: { name },
      data,
    });
    return this.redactSmtpPassword(realm);
  }

  async remove(name: string) {
    await this.findByNameRaw(name);
    return this.prisma.realm.delete({ where: { name } });
  }
}

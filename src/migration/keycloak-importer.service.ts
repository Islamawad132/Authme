import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import type { KeycloakRealmExport, KeycloakUser, KeycloakClient, KeycloakGroup } from './keycloak-types.js';
import { createEmptyReport, type MigrationReport } from './migration-report.js';

export interface KeycloakImportOptions {
  dryRun: boolean;
  targetRealm?: string;
}

@Injectable()
export class KeycloakImporterService {
  private readonly logger = new Logger(KeycloakImporterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async importRealm(
    data: KeycloakRealmExport,
    options: KeycloakImportOptions,
  ): Promise<MigrationReport> {
    const report = createEmptyReport('keycloak', options.dryRun);
    const realmName = options.targetRealm ?? data.realm;

    // 1. Create or find realm
    const realmId = await this.importRealmEntity(data, realmName, report, options.dryRun);
    if (!realmId) {
      report.completedAt = new Date();
      return report;
    }

    // 2. Import roles
    await this.importRoles(data, realmId, report, options.dryRun);

    // 3. Import groups
    await this.importGroups(data.groups ?? [], realmId, null, report, options.dryRun);

    // 4. Import client scopes
    await this.importClientScopes(data, realmId, report, options.dryRun);

    // 5. Import clients
    await this.importClients(data, realmId, report, options.dryRun);

    // 6. Import users
    await this.importUsers(data, realmId, report, options.dryRun);

    // 7. Import identity providers
    await this.importIdentityProviders(data, realmId, report, options.dryRun);

    report.completedAt = new Date();
    return report;
  }

  private async importRealmEntity(
    data: KeycloakRealmExport,
    realmName: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<string | null> {
    try {
      const existing = await this.prisma.realm.findUnique({ where: { name: realmName } });
      if (existing) {
        report.summary.realms.skipped++;
        report.warnings.push({ entity: 'realm', message: `Realm '${realmName}' already exists, using existing` });
        return existing.id;
      }

      if (dryRun) {
        report.summary.realms.created++;
        return 'dry-run-realm-id';
      }

      const realm = await this.prisma.realm.create({
        data: {
          name: realmName,
          displayName: data.displayName,
          enabled: data.enabled ?? true,
          registrationAllowed: data.registrationAllowed ?? false,
          accessTokenLifespan: data.accessTokenLifespan ?? 300,
          refreshTokenLifespan: data.ssoSessionMaxLifespan ?? 1800,
          ...(data.smtpServer?.host && {
            smtpHost: data.smtpServer.host,
            smtpPort: parseInt(data.smtpServer.port ?? '587', 10),
            smtpFrom: data.smtpServer.from,
            smtpUser: data.smtpServer.user,
            smtpPassword: data.smtpServer.password,
            smtpSsl: data.smtpServer.ssl === 'true',
          }),
          ...(data.bruteForceProtected && {
            bruteForceProtected: true,
            maxLoginFailures: data.failureFactor ?? 5,
          }),
        },
      });

      report.summary.realms.created++;
      return realm.id;
    } catch (error: any) {
      report.summary.realms.failed++;
      report.errors.push({ entity: 'realm', name: realmName, error: error.message });
      return null;
    }
  }

  private async importRoles(
    data: KeycloakRealmExport,
    realmId: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const role of data.roles?.realm ?? []) {
      if (['offline_access', 'uma_authorization', 'default-roles-' + data.realm].includes(role.name)) {
        continue; // Skip Keycloak built-in roles
      }
      try {
        const existing = await this.prisma.role.findFirst({
          where: { realmId, name: role.name, clientId: null },
        });
        if (existing) {
          report.summary.roles.skipped++;
          continue;
        }
        if (!dryRun) {
          await this.prisma.role.create({
            data: { realmId, name: role.name, description: role.description },
          });
        }
        report.summary.roles.created++;
      } catch (error: any) {
        report.summary.roles.failed++;
        report.errors.push({ entity: 'role', name: role.name, error: error.message });
      }
    }
  }

  private async importGroups(
    groups: KeycloakGroup[],
    realmId: string,
    parentId: string | null,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const group of groups) {
      try {
        const existing = await this.prisma.group.findFirst({
          where: { realmId, name: group.name, parentId },
        });
        if (existing) {
          report.summary.groups.skipped++;
          if (group.subGroups?.length) {
            await this.importGroups(group.subGroups, realmId, existing.id, report, dryRun);
          }
          continue;
        }
        let groupId = 'dry-run-group-id';
        if (!dryRun) {
          const created = await this.prisma.group.create({
            data: { realmId, name: group.name, parentId },
          });
          groupId = created.id;
        }
        report.summary.groups.created++;
        if (group.subGroups?.length) {
          await this.importGroups(group.subGroups, realmId, dryRun ? null : groupId, report, dryRun);
        }
      } catch (error: any) {
        report.summary.groups.failed++;
        report.errors.push({ entity: 'group', name: group.name, error: error.message });
      }
    }
  }

  private async importClientScopes(
    data: KeycloakRealmExport,
    realmId: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const scope of data.clientScopes ?? []) {
      try {
        const existing = await this.prisma.clientScope.findFirst({
          where: { realmId, name: scope.name },
        });
        if (existing) {
          report.summary.scopes.skipped++;
          continue;
        }
        if (!dryRun) {
          await this.prisma.clientScope.create({
            data: {
              realmId,
              name: scope.name,
              description: scope.description,
              protocol: scope.protocol ?? 'openid-connect',
            },
          });
        }
        report.summary.scopes.created++;
      } catch (error: any) {
        report.summary.scopes.failed++;
        report.errors.push({ entity: 'scope', name: scope.name, error: error.message });
      }
    }
  }

  private async importClients(
    data: KeycloakRealmExport,
    realmId: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const client of data.clients ?? []) {
      if (this.isKeycloakBuiltinClient(client.clientId)) continue;
      try {
        const existing = await this.prisma.client.findFirst({
          where: { realmId, clientId: client.clientId },
        });
        if (existing) {
          report.summary.clients.skipped++;
          continue;
        }
        if (!dryRun) {
          const grantTypes = this.mapKeycloakGrantTypes(client);
          const secretHash = client.secret ? await this.crypto.hashPassword(client.secret) : null;
          await this.prisma.client.create({
            data: {
              realmId,
              clientId: client.clientId,
              name: client.name,
              enabled: client.enabled ?? true,
              clientType: client.publicClient ? 'PUBLIC' : 'CONFIDENTIAL',
              clientSecret: secretHash,
              redirectUris: client.redirectUris ?? [],
              webOrigins: client.webOrigins ?? [],
              grantTypes,
              consentRequired: client.consentRequired ?? false,
              serviceAccountEnabled: client.serviceAccountsEnabled ?? false,
            },
          });
        }
        report.summary.clients.created++;
      } catch (error: any) {
        report.summary.clients.failed++;
        report.errors.push({ entity: 'client', name: client.clientId, error: error.message });
      }
    }
  }

  private async importUsers(
    data: KeycloakRealmExport,
    realmId: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const user of data.users ?? []) {
      try {
        const existing = await this.prisma.user.findFirst({
          where: { realmId, username: user.username },
        });
        if (existing) {
          report.summary.users.skipped++;
          continue;
        }

        const { hash: rawHash, algorithm, needsHashing } = this.extractKeycloakPassword(user);
        const hash = (needsHashing && rawHash) ? await this.crypto.hashPassword(rawHash) : rawHash;

        if (!dryRun) {
          const created = await this.prisma.user.create({
            data: {
              realmId,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              enabled: user.enabled ?? true,
              emailVerified: user.emailVerified ?? false,
              passwordHash: hash,
              passwordAlgorithm: algorithm,
            },
          });

          // Assign realm roles
          if (user.realmRoles?.length) {
            for (const roleName of user.realmRoles) {
              const role = await this.prisma.role.findFirst({
                where: { realmId, name: roleName, clientId: null },
              });
              if (role) {
                await this.prisma.userRole.create({
                  data: { userId: created.id, roleId: role.id },
                }).catch(() => {}); // Ignore duplicate
              }
            }
          }
        }
        report.summary.users.created++;
      } catch (error: any) {
        report.summary.users.failed++;
        report.errors.push({ entity: 'user', name: user.username, error: error.message });
      }
    }
  }

  private extractKeycloakPassword(user: KeycloakUser): { hash: string | null; algorithm: string; needsHashing?: boolean } {
    const passwordCred = user.credentials?.find(c => c.type === 'password');
    if (!passwordCred) return { hash: null, algorithm: 'argon2' };

    if (passwordCred.hashedSaltedValue && passwordCred.salt) {
      // PBKDF2 format: iterations$salt$hash
      const iterations = passwordCred.hashIterations ?? 27500;
      const hash = `${iterations}$${passwordCred.salt}$${passwordCred.hashedSaltedValue}`;
      return { hash, algorithm: 'pbkdf2-sha256' };
    }

    if (passwordCred.value) {
      // Plain text password (rare) — hash it with Argon2
      return { hash: passwordCred.value, algorithm: 'argon2', needsHashing: true };
    }

    return { hash: null, algorithm: 'argon2' };
  }

  private async importIdentityProviders(
    data: KeycloakRealmExport,
    realmId: string,
    report: MigrationReport,
    dryRun: boolean,
  ): Promise<void> {
    for (const idp of data.identityProviders ?? []) {
      try {
        const existing = await this.prisma.identityProvider.findFirst({
          where: { realmId, alias: idp.alias },
        });
        if (existing) {
          report.summary.identityProviders.skipped++;
          continue;
        }
        if (!dryRun) {
          const providerType = this.mapKeycloakProviderType(idp.providerId);
          await this.prisma.identityProvider.create({
            data: {
              realmId,
              alias: idp.alias,
              displayName: idp.displayName ?? idp.alias,
              providerType,
              enabled: idp.enabled ?? true,
              trustEmail: idp.trustEmail ?? false,
              clientId: idp.config?.clientId ?? '',
              clientSecret: idp.config?.clientSecret ?? '',
              authorizationUrl: idp.config?.authorizationUrl ?? '',
              tokenUrl: idp.config?.tokenUrl ?? '',
              userInfoUrl: idp.config?.userInfoUrl,
              issuer: idp.config?.issuer,
            },
          });
        }
        report.summary.identityProviders.created++;
      } catch (error: any) {
        report.summary.identityProviders.failed++;
        report.errors.push({ entity: 'identity_provider', name: idp.alias, error: error.message });
      }
    }
  }

  private mapKeycloakGrantTypes(client: KeycloakClient): string[] {
    const grants: string[] = [];
    if (client.standardFlowEnabled !== false) grants.push('authorization_code');
    if (client.directAccessGrantsEnabled) grants.push('password');
    if (client.serviceAccountsEnabled) grants.push('client_credentials');
    grants.push('refresh_token');
    return grants;
  }

  private mapKeycloakProviderType(providerId: string): string {
    const map: Record<string, string> = {
      'oidc': 'OIDC',
      'keycloak-oidc': 'OIDC',
      'google': 'OIDC',
      'github': 'OIDC',
      'facebook': 'OIDC',
      'microsoft': 'OIDC',
      'saml': 'SAML',
    };
    return map[providerId] ?? 'OIDC';
  }

  private isKeycloakBuiltinClient(clientId: string): boolean {
    return [
      'account', 'account-console', 'admin-cli', 'broker',
      'realm-management', 'security-admin-console',
    ].includes(clientId);
  }
}

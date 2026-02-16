import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { RealmsModule } from './realms/realms.module.js';
import { UsersModule } from './users/users.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { RolesModule } from './roles/roles.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OAuthModule } from './oauth/oauth.module.js';
import { TokensModule } from './tokens/tokens.module.js';
import { WellKnownModule } from './well-known/well-known.module.js';
import { ScopesModule } from './scopes/scopes.module.js';
import { LoginModule } from './login/login.module.js';
import { IdentityProvidersModule } from './identity-providers/identity-providers.module.js';
import { BrokerModule } from './broker/broker.module.js';
import { ConsentModule } from './consent/consent.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { EmailModule } from './email/email.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { AccountModule } from './account/account.module.js';
import { PasswordPolicyModule } from './password-policy/password-policy.module.js';
import { BruteForceModule } from './brute-force/brute-force.module.js';
import { MfaModule } from './mfa/mfa.module.js';
import { AdminAuthModule } from './admin-auth/admin-auth.module.js';
import { AdminApiKeyGuard } from './common/guards/admin-api-key.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env['THROTTLE_TTL'] ?? '60000', 10),
      limit: parseInt(process.env['THROTTLE_LIMIT'] ?? '100', 10),
    }]),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'admin-ui'),
      serveRoot: '/console',
      serveStaticOptions: {
        index: ['index.html'],
        fallthrough: false,
      },
    }),
    PrismaModule,
    CryptoModule,
    EmailModule,
    VerificationModule,
    PasswordPolicyModule,
    BruteForceModule,
    MfaModule,
    AdminAuthModule,
    RealmsModule,
    UsersModule,
    ClientsModule,
    RolesModule,
    AuthModule,
    OAuthModule,
    TokensModule,
    WellKnownModule,
    ScopesModule,
    LoginModule,
    ConsentModule,
    GroupsModule,
    SessionsModule,
    IdentityProvidersModule,
    BrokerModule,
    AccountModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminApiKeyGuard },
  ],
})
export class AppModule {}

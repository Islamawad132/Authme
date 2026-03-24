import type { Realm, User, Client, Role } from '../../types';
import type { LoginEvent, AdminEvent } from '../../api/events';
import type { RealmStats } from '../../api/stats';

export function makeRealm(overrides: Partial<Realm> = {}): Realm {
  return {
    id: 'realm-1',
    name: 'test-realm',
    displayName: 'Test Realm',
    enabled: true,
    accessTokenLifespan: 300,
    refreshTokenLifespan: 1800,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpPassword: null,
    smtpFrom: null,
    smtpSecure: false,
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireLowercase: false,
    passwordRequireDigits: false,
    passwordRequireSpecialChars: false,
    passwordHistoryCount: 0,
    passwordMaxAgeDays: 0,
    bruteForceEnabled: false,
    maxLoginFailures: 5,
    lockoutDuration: 60,
    failureResetTime: 300,
    permanentLockoutAfter: 0,
    registrationAllowed: false,
    mfaRequired: false,
    offlineTokenLifespan: 2592000,
    eventsEnabled: false,
    eventsExpiration: 0,
    adminEventsEnabled: false,
    themeName: 'default',
    theme: null,
    loginTheme: 'default',
    accountTheme: 'default',
    emailTheme: 'default',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    realmId: 'realm-1',
    username: 'testuser',
    email: 'testuser@example.com',
    emailVerified: false,
    firstName: 'Test',
    lastName: 'User',
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    realmId: 'realm-1',
    clientId: 'my-app',
    clientType: 'CONFIDENTIAL',
    name: 'My Application',
    description: null,
    enabled: true,
    redirectUris: ['https://app.example.com/callback'],
    webOrigins: ['https://app.example.com'],
    grantTypes: ['authorization_code'],
    requireConsent: false,
    backchannelLogoutUri: null,
    backchannelLogoutSessionRequired: false,
    serviceAccountUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    realmId: 'realm-1',
    clientId: null,
    name: 'admin',
    description: 'Administrator role',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeLoginEvent(overrides: Partial<LoginEvent> = {}): LoginEvent {
  return {
    id: 'event-1',
    realmId: 'realm-1',
    userId: 'user-1',
    sessionId: 'session-1',
    type: 'LOGIN',
    clientId: 'my-app',
    ipAddress: '127.0.0.1',
    error: null,
    details: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAdminEvent(overrides: Partial<AdminEvent> = {}): AdminEvent {
  return {
    id: 'admin-event-1',
    realmId: 'realm-1',
    adminUserId: 'admin-1',
    operationType: 'CREATE',
    resourceType: 'USER',
    resourcePath: '/users/user-1',
    representation: null,
    ipAddress: '127.0.0.1',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeStats(overrides: Partial<RealmStats> = {}): RealmStats {
  return {
    activeUsers24h: 5,
    activeUsers7d: 20,
    activeUsers30d: 80,
    loginSuccessCount: 42,
    loginFailureCount: 3,
    activeSessionCount: 12,
    ...overrides,
  };
}

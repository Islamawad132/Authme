export interface Realm {
  id: string;
  name: string;
  displayName: string | null;
  enabled: boolean;
  accessTokenLifespan: number;
  refreshTokenLifespan: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  realmId: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  realmId: string;
  clientId: string;
  clientType: 'CONFIDENTIAL' | 'PUBLIC';
  clientSecret?: string;
  name: string | null;
  description: string | null;
  enabled: boolean;
  redirectUris: string[];
  webOrigins: string[];
  grantTypes: string[];
  requireConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  realmId: string;
  clientId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityProvider {
  id: string;
  realmId: string;
  alias: string;
  displayName: string | null;
  enabled: boolean;
  providerType: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string | null;
  jwksUrl: string | null;
  issuer: string | null;
  defaultScopes: string;
  trustEmail: boolean;
  linkOnly: boolean;
  syncUserProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  realmId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Group[];
  _count?: { userGroups: number; groupRoles: number };
}

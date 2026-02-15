export interface Realm {
  id: string;
  name: string;
  displayName: string;
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
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
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
  name: string;
  description: string;
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
  description: string;
  createdAt: string;
  updatedAt: string;
}

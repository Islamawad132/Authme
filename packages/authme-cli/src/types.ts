export interface CliConfig {
  serverUrl: string;
  accessToken: string;
  apiKey?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface RealmResponse {
  id: string;
  name: string;
  displayName: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface ClientResponse {
  id: string;
  clientId: string;
  name: string | null;
  clientType: string;
  enabled: boolean;
  clientSecret?: string;
  redirectUris: string[];
  grantTypes: string[];
}

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
}

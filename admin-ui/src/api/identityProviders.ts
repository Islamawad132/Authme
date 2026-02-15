import apiClient from './client';
import type { IdentityProvider } from '../types';

export async function getIdentityProviders(
  realmName: string,
): Promise<IdentityProvider[]> {
  const { data } = await apiClient.get<IdentityProvider[]>(
    `/realms/${realmName}/identity-providers`,
  );
  return data;
}

export async function getIdentityProvider(
  realmName: string,
  alias: string,
): Promise<IdentityProvider> {
  const { data } = await apiClient.get<IdentityProvider>(
    `/realms/${realmName}/identity-providers/${alias}`,
  );
  return data;
}

export interface CreateIdpPayload {
  alias: string;
  displayName?: string;
  enabled?: boolean;
  providerType?: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  jwksUrl?: string;
  issuer?: string;
  defaultScopes?: string;
  trustEmail?: boolean;
  linkOnly?: boolean;
  syncUserProfile?: boolean;
}

export async function createIdentityProvider(
  realmName: string,
  payload: CreateIdpPayload,
): Promise<IdentityProvider> {
  const { data } = await apiClient.post<IdentityProvider>(
    `/realms/${realmName}/identity-providers`,
    payload,
  );
  return data;
}

export async function updateIdentityProvider(
  realmName: string,
  alias: string,
  payload: Partial<CreateIdpPayload>,
): Promise<IdentityProvider> {
  const { data } = await apiClient.put<IdentityProvider>(
    `/realms/${realmName}/identity-providers/${alias}`,
    payload,
  );
  return data;
}

export async function deleteIdentityProvider(
  realmName: string,
  alias: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/identity-providers/${alias}`,
  );
}

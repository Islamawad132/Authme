import apiClient from './client';
import type { UserFederation } from '../types';

export async function getFederations(
  realmName: string,
): Promise<UserFederation[]> {
  const { data } = await apiClient.get<UserFederation[]>(
    `/realms/${realmName}/user-federation`,
  );
  return data;
}

export async function getFederation(
  realmName: string,
  id: string,
): Promise<UserFederation> {
  const { data } = await apiClient.get<UserFederation>(
    `/realms/${realmName}/user-federation/${id}`,
  );
  return data;
}

export interface CreateFederationPayload {
  name: string;
  connectionUrl: string;
  bindDn: string;
  bindCredential: string;
  usersDn: string;
  providerType?: string;
  enabled?: boolean;
  priority?: number;
  startTls?: boolean;
  connectionTimeout?: number;
  userObjectClass?: string;
  usernameLdapAttr?: string;
  rdnLdapAttr?: string;
  uuidLdapAttr?: string;
  searchFilter?: string;
  syncMode?: string;
  syncPeriod?: number;
  importEnabled?: boolean;
  editMode?: string;
}

export async function createFederation(
  realmName: string,
  payload: CreateFederationPayload,
): Promise<UserFederation> {
  const { data } = await apiClient.post<UserFederation>(
    `/realms/${realmName}/user-federation`,
    payload,
  );
  return data;
}

export async function updateFederation(
  realmName: string,
  id: string,
  payload: Partial<CreateFederationPayload>,
): Promise<UserFederation> {
  const { data } = await apiClient.put<UserFederation>(
    `/realms/${realmName}/user-federation/${id}`,
    payload,
  );
  return data;
}

export async function deleteFederation(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/user-federation/${id}`,
  );
}

export async function testConnection(
  realmName: string,
  id: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<{ success: boolean; message: string }>(
    `/realms/${realmName}/user-federation/${id}/test-connection`,
  );
  return data;
}

export async function syncFederation(
  realmName: string,
  id: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<{ success: boolean; message: string }>(
    `/realms/${realmName}/user-federation/${id}/sync`,
  );
  return data;
}

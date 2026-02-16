import apiClient from './client';
import type { Client, User } from '../types';

export async function getClients(realmName: string): Promise<Client[]> {
  const { data } = await apiClient.get<Client[]>(
    `/realms/${realmName}/clients`,
  );
  return data;
}

export async function getClientById(
  realmName: string,
  id: string,
): Promise<Client> {
  const { data } = await apiClient.get<Client>(
    `/realms/${realmName}/clients/${id}`,
  );
  return data;
}

export async function createClient(
  realmName: string,
  client: Partial<Client>,
): Promise<Client> {
  const { data } = await apiClient.post<Client>(
    `/realms/${realmName}/clients`,
    client,
  );
  return data;
}

export async function updateClient(
  realmName: string,
  id: string,
  client: Partial<Client>,
): Promise<Client> {
  const { data } = await apiClient.put<Client>(
    `/realms/${realmName}/clients/${id}`,
    client,
  );
  return data;
}

export async function deleteClient(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/clients/${id}`);
}

export async function regenerateSecret(
  realmName: string,
  id: string,
): Promise<{ clientSecret: string }> {
  const { data } = await apiClient.post<{ clientSecret: string }>(
    `/realms/${realmName}/clients/${id}/regenerate-secret`,
  );
  return data;
}

export async function getServiceAccountUser(
  realmName: string,
  clientId: string,
): Promise<User> {
  const { data } = await apiClient.get<User>(
    `/realms/${realmName}/clients/${clientId}/service-account-user`,
  );
  return data;
}

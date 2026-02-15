import apiClient from './client';
import type { Client } from '../types';

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
  const { data } = await apiClient.patch<Client>(
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

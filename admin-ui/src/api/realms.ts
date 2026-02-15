import apiClient from './client';
import type { Realm } from '../types';

export async function getAllRealms(): Promise<Realm[]> {
  const { data } = await apiClient.get<Realm[]>('/realms');
  return data;
}

export async function getRealmByName(name: string): Promise<Realm> {
  const { data } = await apiClient.get<Realm>(`/realms/${name}`);
  return data;
}

export async function createRealm(
  realm: Partial<Realm>,
): Promise<Realm> {
  const { data } = await apiClient.post<Realm>('/realms', realm);
  return data;
}

export async function updateRealm(
  name: string,
  realm: Partial<Realm>,
): Promise<Realm> {
  const { data } = await apiClient.put<Realm>(`/realms/${name}`, realm);
  return data;
}

export async function deleteRealm(name: string): Promise<void> {
  await apiClient.delete(`/realms/${name}`);
}

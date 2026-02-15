import apiClient from './client';
import type { Role } from '../types';

export async function getRealmRoles(realmName: string): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>(
    `/realms/${realmName}/roles`,
  );
  return data;
}

export async function createRealmRole(
  realmName: string,
  role: { name: string; description?: string },
): Promise<Role> {
  const { data } = await apiClient.post<Role>(
    `/realms/${realmName}/roles`,
    role,
  );
  return data;
}

export async function deleteRealmRole(
  realmName: string,
  roleName: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/roles/${roleName}`);
}

export async function getUserRealmRoles(
  realmName: string,
  userId: string,
): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>(
    `/realms/${realmName}/users/${userId}/roles`,
  );
  return data;
}

export async function assignUserRealmRoles(
  realmName: string,
  userId: string,
  roleNames: string[],
): Promise<void> {
  await apiClient.post(
    `/realms/${realmName}/users/${userId}/roles`,
    { roles: roleNames },
  );
}

export async function removeUserRealmRoles(
  realmName: string,
  userId: string,
  roleNames: string[],
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/users/${userId}/roles`,
    { data: { roles: roleNames } },
  );
}

import apiClient from './client';
import type { Group, Role, User } from '../types';

export async function getGroups(realmName: string): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>(
    `/realms/${realmName}/groups`,
  );
  return data;
}

export async function getGroupById(
  realmName: string,
  groupId: string,
): Promise<Group> {
  const { data } = await apiClient.get<Group>(
    `/realms/${realmName}/groups/${groupId}`,
  );
  return data;
}

export async function createGroup(
  realmName: string,
  group: { name: string; description?: string; parentId?: string },
): Promise<Group> {
  const { data } = await apiClient.post<Group>(
    `/realms/${realmName}/groups`,
    group,
  );
  return data;
}

export async function updateGroup(
  realmName: string,
  groupId: string,
  group: { name?: string; description?: string; parentId?: string },
): Promise<Group> {
  const { data } = await apiClient.put<Group>(
    `/realms/${realmName}/groups/${groupId}`,
    group,
  );
  return data;
}

export async function deleteGroup(
  realmName: string,
  groupId: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/groups/${groupId}`);
}

// Members
export async function getGroupMembers(
  realmName: string,
  groupId: string,
): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(
    `/realms/${realmName}/groups/${groupId}/members`,
  );
  return data;
}

export async function addUserToGroup(
  realmName: string,
  userId: string,
  groupId: string,
): Promise<void> {
  await apiClient.put(
    `/realms/${realmName}/users/${userId}/groups/${groupId}`,
  );
}

export async function removeUserFromGroup(
  realmName: string,
  userId: string,
  groupId: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/users/${userId}/groups/${groupId}`,
  );
}

export async function getUserGroups(
  realmName: string,
  userId: string,
): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>(
    `/realms/${realmName}/users/${userId}/groups`,
  );
  return data;
}

// Role mappings
export async function getGroupRoles(
  realmName: string,
  groupId: string,
): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>(
    `/realms/${realmName}/groups/${groupId}/role-mappings`,
  );
  return data;
}

export async function assignGroupRoles(
  realmName: string,
  groupId: string,
  roleNames: string[],
): Promise<void> {
  await apiClient.post(
    `/realms/${realmName}/groups/${groupId}/role-mappings`,
    { roleNames },
  );
}

export async function removeGroupRoles(
  realmName: string,
  groupId: string,
  roleNames: string[],
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/groups/${groupId}/role-mappings`,
    { data: { roleNames } },
  );
}

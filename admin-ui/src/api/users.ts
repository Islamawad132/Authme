import apiClient from './client';
import type { User } from '../types';

export async function getUsers(
  realmName: string,
  skip = 0,
  limit = 50,
): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(
    `/realms/${realmName}/users`,
    { params: { skip, limit } },
  );
  return data;
}

export async function getUserById(
  realmName: string,
  id: string,
): Promise<User> {
  const { data } = await apiClient.get<User>(
    `/realms/${realmName}/users/${id}`,
  );
  return data;
}

export async function createUser(
  realmName: string,
  user: Partial<User> & { password?: string },
): Promise<User> {
  const { data } = await apiClient.post<User>(
    `/realms/${realmName}/users`,
    user,
  );
  return data;
}

export async function updateUser(
  realmName: string,
  id: string,
  user: Partial<User>,
): Promise<User> {
  const { data } = await apiClient.put<User>(
    `/realms/${realmName}/users/${id}`,
    user,
  );
  return data;
}

export async function deleteUser(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/users/${id}`);
}

export async function resetPassword(
  realmName: string,
  id: string,
  password: string,
): Promise<void> {
  await apiClient.put(
    `/realms/${realmName}/users/${id}/reset-password`,
    { password },
  );
}

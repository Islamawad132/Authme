import apiClient from './client';

export interface SessionInfo {
  id: string;
  type: 'oauth' | 'sso';
  userId: string;
  username: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export async function getRealmSessions(realmName: string): Promise<SessionInfo[]> {
  const { data } = await apiClient.get<SessionInfo[]>(
    `/realms/${realmName}/sessions`,
  );
  return data;
}

export async function getUserSessions(
  realmName: string,
  userId: string,
): Promise<SessionInfo[]> {
  const { data } = await apiClient.get<SessionInfo[]>(
    `/realms/${realmName}/users/${userId}/sessions`,
  );
  return data;
}

export async function revokeSession(
  realmName: string,
  sessionId: string,
  type: 'oauth' | 'sso',
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/sessions/${sessionId}?type=${type}`,
  );
}

export async function revokeAllUserSessions(
  realmName: string,
  userId: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/users/${userId}/sessions`,
  );
}

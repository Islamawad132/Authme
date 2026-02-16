import apiClient from './client';

export interface LoginEvent {
  id: string;
  realmId: string;
  userId: string | null;
  sessionId: string | null;
  type: string;
  clientId: string | null;
  ipAddress: string | null;
  error: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminEvent {
  id: string;
  realmId: string;
  adminUserId: string;
  operationType: string;
  resourceType: string;
  resourcePath: string;
  representation: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export async function getLoginEvents(
  realmName: string,
  query?: { type?: string; userId?: string; clientId?: string; dateFrom?: string; dateTo?: string; first?: number; max?: number },
): Promise<LoginEvent[]> {
  const params: Record<string, string> = {};
  if (query?.type) params.type = query.type;
  if (query?.userId) params.userId = query.userId;
  if (query?.clientId) params.clientId = query.clientId;
  if (query?.dateFrom) params.dateFrom = query.dateFrom;
  if (query?.dateTo) params.dateTo = query.dateTo;
  if (query?.first !== undefined) params.first = String(query.first);
  if (query?.max !== undefined) params.max = String(query.max);

  const { data } = await apiClient.get<LoginEvent[]>(`/realms/${realmName}/events`, { params });
  return data;
}

export async function clearLoginEvents(realmName: string): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/events`);
}

export async function getAdminEvents(
  realmName: string,
  query?: { operationType?: string; resourceType?: string; dateFrom?: string; dateTo?: string; first?: number; max?: number },
): Promise<AdminEvent[]> {
  const params: Record<string, string> = {};
  if (query?.operationType) params.operationType = query.operationType;
  if (query?.resourceType) params.resourceType = query.resourceType;
  if (query?.dateFrom) params.dateFrom = query.dateFrom;
  if (query?.dateTo) params.dateTo = query.dateTo;
  if (query?.first !== undefined) params.first = String(query.first);
  if (query?.max !== undefined) params.max = String(query.max);

  const { data } = await apiClient.get<AdminEvent[]>(`/realms/${realmName}/admin-events`, { params });
  return data;
}

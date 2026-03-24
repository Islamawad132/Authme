import apiClient from './client';

export interface RealmStats {
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  loginSuccessCount: number;
  loginFailureCount: number;
  activeSessionCount: number;
}

export async function getRealmStats(realmName: string): Promise<RealmStats> {
  const { data } = await apiClient.get<RealmStats>(`/realms/${realmName}/stats`);
  return data;
}

export interface HealthStatus {
  status: string;
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const { data } = await apiClient.get<HealthStatus>('/health/ready', {
    // Use absolute path — health is not under /admin
    baseURL: '/',
  });
  return data;
}

import apiClient from './client';

// ─── Types ──────────────────────────────────────────────────

export type StepType =
  | 'password'
  | 'totp'
  | 'webauthn'
  | 'social'
  | 'ldap'
  | 'email_otp'
  | 'consent';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface FlowStepCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface FlowStep {
  id: string;
  type: StepType;
  required: boolean;
  order: number;
  condition?: FlowStepCondition | null;
  fallbackStepId?: string | null;
  config?: Record<string, unknown>;
}

export interface AuthFlow {
  id: string;
  realmId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  steps: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuthFlowPayload {
  name: string;
  description?: string;
  isDefault?: boolean;
  steps: FlowStep[];
}

export interface UpdateAuthFlowPayload {
  name?: string;
  description?: string;
  isDefault?: boolean;
  steps?: FlowStep[];
}

// ─── API Functions ───────────────────────────────────────────

export async function getAuthFlows(realmName: string): Promise<AuthFlow[]> {
  const { data } = await apiClient.get<AuthFlow[]>(
    `/realms/${realmName}/auth-flows`,
  );
  return data;
}

export async function getAuthFlowById(
  realmName: string,
  id: string,
): Promise<AuthFlow> {
  const { data } = await apiClient.get<AuthFlow>(
    `/realms/${realmName}/auth-flows/${id}`,
  );
  return data;
}

export async function createAuthFlow(
  realmName: string,
  payload: CreateAuthFlowPayload,
): Promise<AuthFlow> {
  const { data } = await apiClient.post<AuthFlow>(
    `/realms/${realmName}/auth-flows`,
    payload,
  );
  return data;
}

export async function updateAuthFlow(
  realmName: string,
  id: string,
  payload: UpdateAuthFlowPayload,
): Promise<AuthFlow> {
  const { data } = await apiClient.put<AuthFlow>(
    `/realms/${realmName}/auth-flows/${id}`,
    payload,
  );
  return data;
}

export async function deleteAuthFlow(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/auth-flows/${id}`);
}

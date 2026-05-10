import apiClient from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContinuousRiskEvent {
  id: string;
  realmId: string;
  sessionId: string;
  userId: string;
  riskScoreBefore: number;
  riskScoreAfter: number;
  riskLevelBefore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskLevelAfter: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trustScoreBefore: number;
  trustScoreAfter: number;
  action: 'NO_ACTION' | 'NOTIFY' | 'STEP_UP_REQUIRED' | 'TERMINATE_SESSION';
  signalType:
    | 'device_posture'
    | 'network_context'
    | 'behavioral_biometrics'
    | 'impossible_travel'
    | 'baseline_monitor';
  signalData: Record<string, unknown>;
  evaluatedAt: string;
  createdAt: string;
}

export interface RiskEventListResponse {
  items: ContinuousRiskEvent[];
  total: number;
  first: number;
  max: number;
}

export interface RiskDistribution {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface DailyTrend {
  date: string;
  total: number;
  stepUp: number;
  terminate: number;
}

export interface ContinuousRiskDashboard {
  period: { from: string; to: string };
  activeSessions: number;
  totalEvaluations: number;
  stepUpTriggered: number;
  sessionsTerminated: number;
  avgRiskScore: number;
  avgTrustScore: number;
  distribution: RiskDistribution;
  trend: DailyTrend[];
}

export interface SessionRiskProfile {
  id: string;
  realmId: string;
  sessionId: string;
  userId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trustScore: number;
  stepUpRequired: boolean;
  terminateSession: boolean;
  lastEvaluatedAt: string;
  devicePosture: Record<string, unknown>;
  networkContext: Record<string, unknown>;
  behavioralBiometrics: Record<string, unknown>;
  impossibleTravel: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SessionProfileListResponse {
  items: SessionRiskProfile[];
  total: number;
  first: number;
  max: number;
}

export interface SessionProfileDetail {
  profile: SessionRiskProfile;
  recentEvents: ContinuousRiskEvent[];
}

export interface DevicePostureRecord {
  id: string;
  realmId: string;
  sessionId: string;
  userId: string;
  osType: string;
  osVersion: string;
  securityPatchLevel: string | null;
  diskEncryption: boolean;
  screenLockEnabled: boolean;
  deviceType: string;
  managedDevice: boolean;
  jailbreakDetected: boolean;
  firewallEnabled: boolean;
  antivirusActive: boolean;
  complianceStatus: string;
  complianceScore: number;
  reportedAt: string;
  createdAt: string;
}

export interface NetworkContextRecord {
  id: string;
  realmId: string;
  sessionId: string;
  userId: string;
  ipAddress: string;
  ipVersion: number;
  isp: string | null;
  asn: string | null;
  asnReputation: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isVpn: boolean;
  isTor: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  hostingProvider: string | null;
  networkType: string;
  ispRiskLevel: string | null;
  geoVelocityAnomaly: boolean;
  networkContextData: Record<string, unknown>;
  capturedAt: string;
  createdAt: string;
}

export interface BehavioralBiometricProfile {
  id: string;
  userId: string;
  sampleCount: number;
  modelConfidence: number;
  anomalyThreshold: number;
  typingBaseline: Record<string, unknown>;
  mouseBaseline: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
}

export interface BehavioralSample {
  id: string;
  userId: string;
  sessionId: string | null;
  sampleType: string;
  typingPattern: Record<string, unknown> | null;
  mousePattern: Record<string, unknown> | null;
  anomalyScore: number;
  isAnomaly: boolean;
  collectedAt: string;
  createdAt: string;
}

export interface BehavioralBiometricsResponse {
  profile: BehavioralBiometricProfile;
  recentSamples: BehavioralSample[];
}

export interface UserRiskSummary {
  userId: string;
  activeSessions: number;
  highRiskSessions: number;
  activeStepUps: number;
  avgRiskScore: number;
  recentEventsCount: number;
  behavioralProfile: {
    sampleCount: number;
    modelConfidence: number;
    anomalyThreshold: number;
  } | null;
  recentSamplesCount: number;
}

// ─── Continuous Verification Events ──────────────────────────────────────────

export interface ListRiskEventsParams {
  userId?: string;
  sessionId?: string;
  action?: 'NO_ACTION' | 'NOTIFY' | 'STEP_UP_REQUIRED' | 'TERMINATE_SESSION';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  first?: number;
  max?: number;
}

export async function listRiskEvents(
  realmName: string,
  params: ListRiskEventsParams = {},
): Promise<RiskEventListResponse> {
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.sessionId) searchParams.set('sessionId', params.sessionId);
  if (params.action) searchParams.set('action', params.action);
  if (params.riskLevel) searchParams.set('riskLevel', params.riskLevel);
  if (params.first !== undefined) searchParams.set('first', String(params.first));
  if (params.max !== undefined) searchParams.set('max', String(params.max));

  const { data } = await apiClient.get<RiskEventListResponse>(
    `/realms/${realmName}/continuous-verification/events?${searchParams.toString()}`,
  );
  return data;
}

export async function getRiskEvent(realmName: string, eventId: string): Promise<ContinuousRiskEvent> {
  const { data } = await apiClient.get<ContinuousRiskEvent>(
    `/realms/${realmName}/continuous-verification/events/${eventId}`,
  );
  return data;
}

export async function getContinuousRiskDashboard(realmName: string): Promise<ContinuousRiskDashboard> {
  const { data } = await apiClient.get<ContinuousRiskDashboard>(
    `/realms/${realmName}/continuous-verification/dashboard`,
  );
  return data;
}

// ─── Session Risk Profiles ─────────────────────────────────────────────────────

export interface ListSessionProfilesParams {
  userId?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stepUpRequired?: boolean;
  first?: number;
  max?: number;
}

export async function listSessionProfiles(
  realmName: string,
  params: ListSessionProfilesParams = {},
): Promise<SessionProfileListResponse> {
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.riskLevel) searchParams.set('riskLevel', params.riskLevel);
  if (params.stepUpRequired !== undefined) {
    searchParams.set('stepUpRequired', String(params.stepUpRequired));
  }
  if (params.first !== undefined) searchParams.set('first', String(params.first));
  if (params.max !== undefined) searchParams.set('max', String(params.max));

  const { data } = await apiClient.get<SessionProfileListResponse>(
    `/realms/${realmName}/continuous-verification/session-profiles?${searchParams.toString()}`,
  );
  return data;
}

export async function getSessionProfile(
  realmName: string,
  sessionId: string,
): Promise<SessionProfileDetail> {
  const { data } = await apiClient.get<SessionProfileDetail>(
    `/realms/${realmName}/continuous-verification/session-profiles/${sessionId}`,
  );
  return data;
}

// ─── Device Posture ───────────────────────────────────────────────────────────

export async function getDevicePosture(
  realmName: string,
  sessionId: string,
): Promise<DevicePostureRecord[]> {
  const { data } = await apiClient.get<DevicePostureRecord[]>(
    `/realms/${realmName}/continuous-verification/device-posture/${sessionId}`,
  );
  return data;
}

// ─── Network Context ──────────────────────────────────────────────────────────

export async function getNetworkContext(
  realmName: string,
  sessionId: string,
): Promise<NetworkContextRecord[]> {
  const { data } = await apiClient.get<NetworkContextRecord[]>(
    `/realms/${realmName}/continuous-verification/network-context/${sessionId}`,
  );
  return data;
}

// ─── Behavioral Biometrics ────────────────────────────────────────────────────

export async function getBehavioralBiometrics(
  realmName: string,
  userId: string,
): Promise<BehavioralBiometricsResponse> {
  const { data } = await apiClient.get<BehavioralBiometricsResponse>(
    `/realms/${realmName}/continuous-verification/behavioral/${userId}`,
  );
  return data;
}

// ─── User Risk Summary ────────────────────────────────────────────────────────

export async function getUserRiskSummary(
  realmName: string,
  userId: string,
): Promise<UserRiskSummary> {
  const { data } = await apiClient.get<UserRiskSummary>(
    `/realms/${realmName}/continuous-verification/user/${userId}/summary`,
  );
  return data;
}

// ─── Session Risk (Alternate endpoint) ───────────────────────────────────────

export interface SessionRiskListParams {
  userId?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stepUpRequired?: boolean;
  first?: number;
  max?: number;
}

export async function listSessionRisk(
  realmName: string,
  params: SessionRiskListParams = {},
): Promise<SessionProfileListResponse> {
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.riskLevel) searchParams.set('riskLevel', params.riskLevel);
  if (params.stepUpRequired !== undefined) {
    searchParams.set('stepUpRequired', String(params.stepUpRequired));
  }
  if (params.first !== undefined) searchParams.set('first', String(params.first));
  if (params.max !== undefined) searchParams.set('max', String(params.max));

  const { data } = await apiClient.get<SessionProfileListResponse>(
    `/realms/${realmName}/session-risk?${searchParams.toString()}`,
  );
  return data;
}

export async function getSessionRiskDashboard(
  realmName: string,
): Promise<ContinuousRiskDashboard> {
  const { data } = await apiClient.get<ContinuousRiskDashboard>(
    `/realms/${realmName}/session-risk/dashboard`,
  );
  return data;
}

export async function getSessionRisk(
  realmName: string,
  sessionId: string,
): Promise<SessionProfileDetail> {
  const { data } = await apiClient.get<SessionProfileDetail>(
    `/realms/${realmName}/session-risk/${sessionId}`,
  );
  return data;
}

export async function triggerSessionRiskReevaluation(
  realmName: string,
  sessionId: string,
): Promise<SessionRiskProfile> {
  const { data } = await apiClient.post<SessionRiskProfile>(
    `/realms/${realmName}/session-risk/${sessionId}/evaluate`,
  );
  return data;
}
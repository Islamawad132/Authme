import apiClient from './client';
import type { SamlServiceProvider } from '../types';

export async function getSamlSps(
  realmName: string,
): Promise<SamlServiceProvider[]> {
  const { data } = await apiClient.get<SamlServiceProvider[]>(
    `/realms/${realmName}/saml-service-providers`,
  );
  return data;
}

export async function getSamlSp(
  realmName: string,
  id: string,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.get<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers/${id}`,
  );
  return data;
}

export interface CreateSamlSpPayload {
  entityId: string;
  name: string;
  acsUrl: string;
  enabled?: boolean;
  sloUrl?: string;
  certificate?: string;
  nameIdFormat?: string;
  signAssertions?: boolean;
  signResponses?: boolean;
  attributeStatements?: Record<string, unknown>;
  validRedirectUris?: string[];
}

export async function createSamlSp(
  realmName: string,
  payload: CreateSamlSpPayload,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.post<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers`,
    payload,
  );
  return data;
}

export async function updateSamlSp(
  realmName: string,
  id: string,
  payload: Partial<CreateSamlSpPayload>,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.put<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers/${id}`,
    payload,
  );
  return data;
}

export async function deleteSamlSp(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/saml-service-providers/${id}`,
  );
}

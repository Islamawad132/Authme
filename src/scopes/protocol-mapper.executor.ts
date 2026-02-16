import { Injectable } from '@nestjs/common';
import type { ProtocolMapper } from '@prisma/client';

export interface MapperContext {
  userId: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  realmRoles: string[];
  resourceAccess: Record<string, { roles: string[] }>;
}

@Injectable()
export class ProtocolMapperExecutor {
  executeMappers(
    mappers: ProtocolMapper[],
    context: MapperContext,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    for (const mapper of mappers) {
      this.executeMapper(mapper, context, payload);
    }
    return payload;
  }

  private executeMapper(
    mapper: ProtocolMapper,
    context: MapperContext,
    payload: Record<string, unknown>,
  ): void {
    const config = mapper.config as Record<string, unknown>;

    switch (mapper.mapperType) {
      case 'oidc-usermodel-attribute-mapper':
        this.executeUserModelAttributeMapper(config, context, payload);
        break;
      case 'oidc-hardcoded-claim-mapper':
        this.executeHardcodedClaimMapper(config, payload);
        break;
      case 'oidc-role-list-mapper':
        this.executeRoleListMapper(config, context, payload);
        break;
      case 'oidc-audience-mapper':
        this.executeAudienceMapper(config, payload);
        break;
      case 'oidc-full-name-mapper':
        this.executeFullNameMapper(config, context, payload);
        break;
      default:
        break;
    }
  }

  private executeUserModelAttributeMapper(
    config: Record<string, unknown>,
    context: MapperContext,
    payload: Record<string, unknown>,
  ): void {
    const userAttribute = config['user.attribute'] as string | undefined;
    const claimName = config['claim.name'] as string | undefined;
    if (!userAttribute || !claimName) return;

    const attributeMap: Record<string, unknown> = {
      username: context.username,
      email: context.email,
      emailVerified: context.emailVerified,
      firstName: context.firstName,
      lastName: context.lastName,
    };

    const value = attributeMap[userAttribute];
    if (value !== undefined && value !== null) {
      payload[claimName] = value;
    }
  }

  private executeHardcodedClaimMapper(
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): void {
    const claimName = config['claim.name'] as string | undefined;
    const claimValue = config['claim.value'] as string | undefined;
    if (!claimName || claimValue === undefined) return;
    payload[claimName] = claimValue;
  }

  private executeRoleListMapper(
    config: Record<string, unknown>,
    context: MapperContext,
    payload: Record<string, unknown>,
  ): void {
    const claimName = (config['claim.name'] as string) ?? 'realm_access';
    if (claimName === 'realm_access') {
      payload['realm_access'] = { roles: context.realmRoles };
      payload['resource_access'] = context.resourceAccess;
    }
  }

  private executeAudienceMapper(
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): void {
    const audience = config['included.client.audience'] as string | undefined;
    if (!audience) return;
    const existing = payload['aud'];
    if (Array.isArray(existing)) {
      (existing as string[]).push(audience);
    } else if (typeof existing === 'string') {
      payload['aud'] = [existing, audience];
    } else {
      payload['aud'] = audience;
    }
  }

  private executeFullNameMapper(
    _config: Record<string, unknown>,
    context: MapperContext,
    payload: Record<string, unknown>,
  ): void {
    const name =
      context.firstName && context.lastName
        ? `${context.firstName} ${context.lastName}`
        : (context.firstName ?? context.lastName ?? undefined);
    if (name) {
      payload['name'] = name;
    }
  }
}

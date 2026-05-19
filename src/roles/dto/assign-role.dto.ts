import { IsArray, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a role entry in the Keycloak-style format: { name: string }
 */
class RoleEntry {
  @IsString()
  name!: string;
}

/**
 * DTO for assigning or removing roles.
 *
 * Accepts two equivalent formats:
 *   - `roleNames: string[]`  – simple string array (preferred)
 *   - `roles: { name: string }[]` – Keycloak-compatible object array
 *
 * After class-transformer processing, `roleNames` is always populated from
 * whichever format the caller used.  The controller continues to reference
 * `dto.roleNames` without any change.
 */
export class AssignRolesDto {
  @ApiPropertyOptional({
    example: ['admin', 'user'],
    description: 'Role names to assign/remove (preferred format)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  /**
   * If the caller sent `roles: [{name: …}]` instead of `roleNames: […]`,
   * extract the names here so that the rest of the codebase can keep using
   * `dto.roleNames` without modification.
   */
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) => {
      // Already set — use it as-is.
      if (Array.isArray(value) && value.length > 0) return value;
      // Fall back to the Keycloak-style `roles` field.
      const roles = obj['roles'];
      if (Array.isArray(roles)) {
        return roles.map((r: unknown) =>
          r && typeof r === 'object' && 'name' in r
            ? (r as { name: string }).name
            : r,
        );
      }
      return value ?? [];
    },
  )
  roleNames!: string[];

  @ApiPropertyOptional({
    example: [{ name: 'admin' }, { name: 'user' }],
    description: 'Keycloak-compatible role list (alternative to roleNames)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleEntry)
  roles?: RoleEntry[];
}

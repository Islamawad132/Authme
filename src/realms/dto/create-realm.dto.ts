import { IsString, IsOptional, IsBoolean, IsInt, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRealmDto {
  @ApiProperty({ example: 'my-app' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Realm name must be a lowercase slug (e.g. "my-app")',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'My Application' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 300 })
  @IsOptional()
  @IsInt()
  @Min(60)
  accessTokenLifespan?: number;

  @ApiPropertyOptional({ default: 1800 })
  @IsOptional()
  @IsInt()
  @Min(60)
  refreshTokenLifespan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ default: 587 })
  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpFrom?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  // Password policies
  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  passwordMinLength?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  passwordRequireDigits?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChars?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passwordHistoryCount?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passwordMaxAgeDays?: number;

  // Brute force
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bruteForceEnabled?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxLoginFailures?: number;

  @ApiPropertyOptional({ default: 900 })
  @IsOptional()
  @IsInt()
  @Min(1)
  lockoutDuration?: number;

  @ApiPropertyOptional({ default: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  failureResetTime?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  permanentLockoutAfter?: number;

  // MFA
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  // Offline tokens
  @ApiPropertyOptional({ default: 2592000 })
  @IsOptional()
  @IsInt()
  @Min(60)
  offlineTokenLifespan?: number;

  // Events configuration
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  eventsEnabled?: boolean;

  @ApiPropertyOptional({ default: 604800 })
  @IsOptional()
  @IsInt()
  @Min(60)
  eventsExpiration?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  adminEventsEnabled?: boolean;
}

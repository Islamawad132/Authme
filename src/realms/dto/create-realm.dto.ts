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
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class MagicLinkRequestDto {
  @ApiProperty({
    description: 'Email address to send the magic link to',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Custom magic link base URL (optional, defaults to configured value)',
    example: 'https://app.example.com/magic-link',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'magicLinkUrl must be a valid URL' })
  magicLinkUrl?: string;
}

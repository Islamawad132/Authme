import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartImpersonationDto {
  @ApiProperty({ description: 'The ID of the admin user initiating impersonation' })
  @IsString()
  @IsNotEmpty()
  adminUserId!: string;
}

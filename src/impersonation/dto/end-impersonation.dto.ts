import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndImpersonationDto {
  @ApiProperty({ description: 'The impersonation session ID to end' })
  @IsString()
  @IsNotEmpty()
  impersonationSessionId!: string;

  @ApiProperty({ description: 'The admin user ID ending the impersonation' })
  @IsString()
  @IsNotEmpty()
  adminUserId!: string;
}

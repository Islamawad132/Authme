import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EndImpersonationBodyDto {
  @ApiProperty({ description: 'The impersonation session ID to end' })
  @IsString()
  @IsNotEmpty()
  impersonationSessionId!: string;
}

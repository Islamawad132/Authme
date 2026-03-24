import { IsString, IsFQDN } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDomainDto {
  @ApiProperty({ example: 'acme.com' })
  @IsString()
  @IsFQDN()
  domain!: string;
}

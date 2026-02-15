import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto.js';

export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ['clientId'] as const),
) {}

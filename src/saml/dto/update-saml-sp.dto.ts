import { PartialType } from '@nestjs/swagger';
import { CreateSamlSpDto } from './create-saml-sp.dto.js';

export class UpdateSamlSpDto extends PartialType(CreateSamlSpDto) {}

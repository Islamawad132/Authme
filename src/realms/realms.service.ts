import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwkService } from '../crypto/jwk.service.js';
import { CreateRealmDto } from './dto/create-realm.dto.js';
import { UpdateRealmDto } from './dto/update-realm.dto.js';

@Injectable()
export class RealmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwkService: JwkService,
  ) {}

  async create(dto: CreateRealmDto) {
    const existing = await this.prisma.realm.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Realm '${dto.name}' already exists`);
    }

    const keyPair = await this.jwkService.generateRsaKeyPair();

    return this.prisma.realm.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        enabled: dto.enabled,
        accessTokenLifespan: dto.accessTokenLifespan,
        refreshTokenLifespan: dto.refreshTokenLifespan,
        signingKeys: {
          create: {
            kid: keyPair.kid,
            algorithm: 'RS256',
            publicKey: keyPair.publicKeyPem,
            privateKey: keyPair.privateKeyPem,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.realm.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByName(name: string) {
    const realm = await this.prisma.realm.findUnique({
      where: { name },
    });
    if (!realm) {
      throw new NotFoundException(`Realm '${name}' not found`);
    }
    return realm;
  }

  async update(name: string, dto: UpdateRealmDto) {
    await this.findByName(name);
    return this.prisma.realm.update({
      where: { name },
      data: {
        displayName: dto.displayName,
        enabled: dto.enabled,
        accessTokenLifespan: dto.accessTokenLifespan,
        refreshTokenLifespan: dto.refreshTokenLifespan,
      },
    });
  }

  async remove(name: string) {
    await this.findByName(name);
    return this.prisma.realm.delete({ where: { name } });
  }
}

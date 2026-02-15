import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class CryptoService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateSecret(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}

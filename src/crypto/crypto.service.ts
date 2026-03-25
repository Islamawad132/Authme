import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes, createHash, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

/** Maximum password length accepted by hashPassword / verifyPassword.
 *  Argon2 has no built-in length limit; feeding it a multi-megabyte string
 *  causes CPU exhaustion (DoS).  1 024 characters is a generous practical
 *  limit that covers every legitimate password while bounding hashing time.
 */
const MAX_PASSWORD_LENGTH = 1024;

// Algorithm constants for AES-256-GCM symmetric encryption.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit authentication tag

@Injectable()
export class CryptoService {
  /**
   * 32-byte key derived from the WEBHOOK_SECRET_KEY environment variable.
   * The raw env value is run through scrypt so operators can supply any
   * length string without having to produce exactly 32 bytes themselves.
   * Falls back to a deterministic development key when the variable is
   * absent – startup should be blocked by env validation in production.
   */
  private readonly encryptionKey: Buffer = (() => {
    const raw = process.env['WEBHOOK_SECRET_KEY'] ?? 'dev-webhook-secret-key-replace-me';
    // scrypt: N=2^14, r=8, p=1 → 32-byte key
    // Salt is read from WEBHOOK_ENCRYPTION_SALT so operators can rotate it;
    // falls back to the original hardcoded value for backwards compatibility.
    const salt = process.env['WEBHOOK_ENCRYPTION_SALT'] ?? 'authme-webhook-salt';
    return scryptSync(raw, salt, 32) as Buffer;
  })();

  async hashPassword(password: string): Promise<string> {
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new UnprocessableEntityException(
        `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`,
      );
    }
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    if (password.length > MAX_PASSWORD_LENGTH) {
      // Reject immediately — do not pass an oversized input to Argon2.
      // Return false rather than throwing so callers treat it as a bad
      // credential (no information about the limit is leaked to the client
      // beyond the normal "invalid credentials" response).
      return false;
    }
    return argon2.verify(hash, password);
  }

  generateSecret(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt a plaintext string with AES-256-GCM.
   *
   * Output format (base64-encoded):  <12-byte IV> | <ciphertext> | <16-byte tag>
   *
   * A fresh random IV is generated on every call, so encrypting the same
   * plaintext twice will produce different ciphertext.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Pack: iv (12) + tag (16) + ciphertext
    const packed = Buffer.concat([iv, tag, encrypted]);
    return packed.toString('base64');
  }

  /**
   * Decrypt a value produced by {@link encrypt}.
   * Throws if the authentication tag does not match (tampering detected).
   */
  decrypt(ciphertext: string): string {
    const packed = Buffer.from(ciphertext, 'base64');
    const iv = packed.subarray(0, IV_BYTES);
    const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = packed.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}

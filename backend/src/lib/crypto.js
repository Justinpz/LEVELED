'use strict';

/**
 * AES-256-GCM encryption helpers for WHOOP tokens at rest.
 *
 * Storage shape (per token):
 *   - ciphertext: Buffer = <encrypted_data> || <auth_tag>  (auth tag appended)
 *   - iv:         Buffer = 12 random bytes (GCM standard, NEVER reuse with same key)
 *
 * Each token (access, refresh) gets its OWN IV. Reusing a GCM IV under the
 * same key across two different plaintexts breaks confidentiality and
 * authenticity guarantees — non-negotiable.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set in environment');
  }
  if (hex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars); got ${hex.length}`
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a UTF-8 plaintext string.
 * @param {string} plaintext
 * @returns {{ ciphertext: Buffer, iv: Buffer }}
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encrypt(): plaintext must be a non-empty string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]),
    iv,
  };
}

/**
 * Decrypt a ciphertext produced by encrypt().
 * @param {Buffer|Uint8Array} ciphertext
 * @param {Buffer|Uint8Array} iv
 * @returns {string}
 */
function decrypt(ciphertext, iv) {
  const key = getKey();
  const buf = Buffer.isBuffer(ciphertext) ? ciphertext : Buffer.from(ciphertext);
  const ivBuf = Buffer.isBuffer(iv) ? iv : Buffer.from(iv);

  if (ivBuf.length !== IV_LENGTH) {
    throw new Error(`decrypt(): iv must be ${IV_LENGTH} bytes`);
  }
  if (buf.length <= AUTH_TAG_LENGTH) {
    throw new Error('decrypt(): ciphertext too short');
  }

  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(0, buf.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Mask a token for safe logging: shows first 4 / last 4 chars, redacts middle.
 * Never log raw tokens — use this when you must reference one in a log line.
 */
function mask(token) {
  if (typeof token !== 'string' || token.length < 8) return '<redacted>';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

module.exports = { encrypt, decrypt, mask };

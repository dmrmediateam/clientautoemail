'use strict';

const crypto = require('crypto');
const config = require('./config');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const hex = config.encryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decrypt(blob) {
  if (!blob) return null;
  const parts = String(blob).split('.');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [ivB64, tagB64, encB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encrypt, decrypt };

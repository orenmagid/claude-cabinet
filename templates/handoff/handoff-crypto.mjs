import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

const RSA_ALGO = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const AES_ALGO = { name: 'AES-GCM', length: 256 };
const PBKDF2_ITERATIONS = 600_000;

export async function generateKeypair() {
  const pair = await subtle.generateKey(RSA_ALGO, true, ['wrapKey', 'unwrapKey']);
  return {
    publicKey: await subtle.exportKey('jwk', pair.publicKey),
    privateKey: await subtle.exportKey('jwk', pair.privateKey),
  };
}

export async function encryptCredential(plaintext, publicKeyJWK) {
  const publicKey = await subtle.importKey('jwk', publicKeyJWK, RSA_ALGO, false, ['wrapKey']);
  const aesKey = await subtle.generateKey(AES_ALGO, true, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext));
  const wrappedKey = await subtle.wrapKey('raw', aesKey, publicKey, RSA_ALGO);
  const idBytes = webcrypto.getRandomValues(new Uint8Array(6));
  const envelope_id = 'env_' + [...idBytes].map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    envelope_id,
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    wrappedKey: Buffer.from(wrappedKey).toString('base64'),
  };
}

export async function decryptCredential(envelope, privateKeyJWK) {
  const privateKey = await subtle.importKey('jwk', privateKeyJWK, RSA_ALGO, false, ['unwrapKey']);
  const aesKey = await subtle.unwrapKey(
    'raw',
    Buffer.from(envelope.wrappedKey, 'base64'),
    privateKey,
    RSA_ALGO,
    AES_ALGO,
    false,
    ['decrypt'],
  );
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(envelope.iv, 'base64') },
    aesKey,
    Buffer.from(envelope.ciphertext, 'base64'),
  );
  return new TextDecoder().decode(decrypted);
}

export function serializeEnvelope(envelope) {
  return Buffer.from(JSON.stringify(envelope)).toString('base64');
}

export function deserializeEnvelope(base64) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}

export async function encryptPrivateKey(privateKeyJWK, passphrase) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const derived = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AES_ALGO,
    false,
    ['encrypt'],
  );
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, derived, new TextEncoder().encode(JSON.stringify(privateKeyJWK)));

  return {
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
  };
}

export async function decryptPrivateKey(encrypted, passphrase) {
  const keyMaterial = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const derived = await subtle.deriveKey(
    { name: 'PBKDF2', salt: Buffer.from(encrypted.salt, 'base64'), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AES_ALGO,
    false,
    ['decrypt'],
  );
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(encrypted.iv, 'base64') },
    derived,
    Buffer.from(encrypted.ciphertext, 'base64'),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

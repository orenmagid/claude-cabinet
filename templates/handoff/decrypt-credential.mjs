#!/usr/bin/env node
//
// Decrypt a credential envelope using the consultant's passphrase-protected private key.
// Passphrase captured via secure OS dialog — never enters Claude's context.
// stdout: decrypted plaintext (displayed once by the skill, not stored).
//
import { readFile } from 'node:fs/promises';
import { captureSecureInput, DialogCancelledError, DialogUnavailableError } from './secure-input.mjs';
import { decryptCredential, decryptPrivateKey, deserializeEnvelope } from './handoff-crypto.mjs';

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const envelopeInput = getArg('--envelope');
const privateKeyPath = getArg('--private-key') || './keys/consultant.priv.jwk.enc';
const testMode = args.includes('--test');

if (!testMode && !envelopeInput) {
  console.error('Usage: node decrypt-credential.mjs --envelope <base64> [--private-key <path>]');
  console.error('       node decrypt-credential.mjs --test');
  process.exit(1);
}

try {
  if (testMode) {
    const { generateKeypair, encryptCredential, encryptPrivateKey, serializeEnvelope } = await import('./handoff-crypto.mjs');
    const testPassphrase = 'test-pass-123';
    const testPlaintext = 'test-secret-value';

    const { publicKey, privateKey } = await generateKeypair();
    const encrypted = await encryptPrivateKey(privateKey, testPassphrase);
    const envelope = await encryptCredential(testPlaintext, publicKey);
    const serialized = serializeEnvelope(envelope);

    const recovered = decryptPrivateKey(encrypted, testPassphrase);
    const decrypted = await decryptCredential(deserializeEnvelope(serialized), await recovered);

    console.log(JSON.stringify({
      ok: decrypted === testPlaintext,
      detail: decrypted === testPlaintext ? 'Roundtrip passed' : 'Mismatch',
    }));
    process.exit(decrypted === testPlaintext ? 0 : 4);
  }

  const encryptedKey = JSON.parse(await readFile(privateKeyPath, 'utf-8'));
  const envelope = deserializeEnvelope(envelopeInput);

  const passphrase = await captureSecureInput('Enter your private key passphrase');
  const privateKeyJWK = await decryptPrivateKey(encryptedKey, passphrase);
  const plaintext = await decryptCredential(envelope, privateKeyJWK);

  process.stdout.write(plaintext);
} catch (err) {
  if (err instanceof DialogCancelledError) {
    console.error(JSON.stringify({ error: 'cancelled' }));
    process.exit(2);
  }
  if (err instanceof DialogUnavailableError) {
    console.error(JSON.stringify({ error: 'no_dialog', platform: err.platform }));
    process.exit(3);
  }
  if (err.message?.includes('decrypt') || err.message?.includes('OperationError')) {
    console.error(JSON.stringify({ error: 'wrong_passphrase' }));
    process.exit(5);
  }
  console.error(JSON.stringify({ error: 'decrypt_failed', detail: err.message }));
  process.exit(4);
}

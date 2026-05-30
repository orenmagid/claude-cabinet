#!/usr/bin/env node
//
// Single-subprocess credential capture + encryption.
// Plaintext never exits this process, never enters Claude's context or Anthropic's API.
// stdout: serialized encrypted envelope (base64) only.
//
import { readFile } from 'node:fs/promises';
import { captureSecureInput, detectPlatform, DialogCancelledError, DialogUnavailableError } from './secure-input.mjs';
import { encryptCredential, serializeEnvelope } from './handoff-crypto.mjs';

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const prompt = getArg('--prompt');
const publicKeyPath = getArg('--public-key');
const testMode = args.includes('--test');

if (!testMode && (!prompt || !publicKeyPath)) {
  console.error('Usage: node capture-and-encrypt.mjs --prompt <text> --public-key <path>');
  console.error('       node capture-and-encrypt.mjs --test');
  process.exit(1);
}

try {
  if (testMode) {
    const { generateKeypair, decryptCredential, deserializeEnvelope } = await import('./handoff-crypto.mjs');
    const plaintext = 'test-credential-value';
    const { publicKey, privateKey } = await generateKeypair();
    const envelope = await encryptCredential(plaintext, publicKey);
    const serialized = serializeEnvelope(envelope);
    const recovered = deserializeEnvelope(serialized);
    const decrypted = await decryptCredential(recovered, privateKey);

    if (decrypted !== plaintext) {
      console.error(JSON.stringify({ error: 'test_failed', detail: 'Roundtrip mismatch' }));
      process.exit(4);
    }
    console.log(JSON.stringify({
      ok: true,
      platform: detectPlatform(),
      envelope_id: envelope.envelope_id,
    }));
    process.exit(0);
  }

  const publicKeyJWK = JSON.parse(await readFile(publicKeyPath, 'utf-8'));
  const plaintext = await captureSecureInput(prompt);
  const envelope = await encryptCredential(plaintext, publicKeyJWK);
  // Plaintext is now only in local `plaintext` var — GC will collect it.
  // Only the encrypted envelope reaches stdout.
  process.stdout.write(serializeEnvelope(envelope));
} catch (err) {
  if (err instanceof DialogCancelledError) {
    console.error(JSON.stringify({ error: 'cancelled' }));
    process.exit(2);
  }
  if (err instanceof DialogUnavailableError) {
    console.error(JSON.stringify({ error: 'no_dialog', platform: err.platform }));
    process.exit(3);
  }
  console.error(JSON.stringify({ error: 'encrypt_failed', detail: err.message }));
  process.exit(4);
}

#!/usr/bin/env node
import { generateKeypair, encryptPrivateKey } from './handoff-crypto.mjs';
import { captureSecureInput } from './secure-input.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const outdir = getArg('--outdir') || './keys';
const testPassphrase = getArg('--test-passphrase');

let passphrase;
if (testPassphrase) {
  passphrase = testPassphrase;
} else {
  console.error('A passphrase dialog will appear — enter a passphrase to protect your private key.');
  console.error('You will need this passphrase to decrypt credentials via /handoff-status.');
  passphrase = await captureSecureInput('Create a passphrase for your private key');
}

const { publicKey, privateKey } = await generateKeypair();
const encrypted = await encryptPrivateKey(privateKey, passphrase);

await mkdir(resolve(outdir), { recursive: true });
await writeFile(resolve(outdir, 'consultant.pub.jwk'), JSON.stringify(publicKey, null, 2));
await writeFile(resolve(outdir, 'consultant.priv.jwk.enc'), JSON.stringify(encrypted, null, 2));

console.log(`Keys written to ${outdir}/`);
console.log('  consultant.pub.jwk      — share with client (ships with plugin)');
console.log('  consultant.priv.jwk.enc — keep private (encrypted with your passphrase)');

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class DialogCancelledError extends Error {
  constructor() { super('User cancelled dialog'); this.code = 'CANCELLED'; }
}

export class DialogUnavailableError extends Error {
  constructor(platform) {
    super(`No secure input dialog available on ${platform}`);
    this.code = 'NO_DIALOG';
    this.platform = platform;
  }
}

export function detectPlatform() {
  switch (process.platform) {
    case 'darwin': return 'macos';
    case 'win32': return 'windows';
    default: return 'linux';
  }
}

function escapeAppleScript(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function captureViaMacOS(prompt) {
  const escaped = escapeAppleScript(prompt);
  const script = `display dialog "${escaped}" with hidden answer default answer ""`;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const match = stdout.match(/text returned:(.*)/);
    if (!match) throw new Error('Dialog returned no value');
    return match[1].trim();
  } catch (err) {
    if (err.stderr?.includes('User canceled') || err.stderr?.includes('(-128)')) {
      throw new DialogCancelledError();
    }
    throw err;
  }
}

async function captureViaZenity(prompt) {
  try {
    const { stdout } = await execFileAsync('zenity', ['--password', '--title', prompt]);
    return stdout.trim();
  } catch (err) {
    if (err.code === 'ENOENT') throw new DialogUnavailableError('linux');
    if (err.status === 1) throw new DialogCancelledError();
    throw err;
  }
}

async function captureViaTerminal(prompt) {
  process.stderr.write('Warning: No GUI dialog available — falling back to terminal input.\n');
  process.stderr.write('Input will NOT be masked. Ensure no one is looking at your screen.\n');
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  process.stderr.write(`${prompt}: `);
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer);
    });
  });
}

async function captureViaPowerShell(prompt) {
  const escaped = prompt.replace(/'/g, "''");
  const script = `$s = Read-Host -Prompt '${escaped}' -AsSecureString; [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`;
  try {
    const { stdout } = await execFileAsync('powershell', ['-Command', script]);
    return stdout.trim();
  } catch (err) {
    if (err.code === 'ENOENT') throw new DialogUnavailableError('windows');
    throw err;
  }
}

export async function captureSecureInput(prompt) {
  const platform = detectPlatform();
  switch (platform) {
    case 'macos': return captureViaMacOS(prompt);
    case 'windows': return captureViaPowerShell(prompt);
    case 'linux': {
      try {
        return await captureViaZenity(prompt);
      } catch (err) {
        if (err instanceof DialogUnavailableError) return captureViaTerminal(prompt);
        throw err;
      }
    }
    default: throw new DialogUnavailableError(process.platform);
  }
}

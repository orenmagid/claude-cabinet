import * as fs from 'node:fs';
import * as path from 'node:path';

const PROGRESS_FILE = '.verify-progress.jsonl';

let progressPath = '';

export function initProgress(cwd: string): void {
  progressPath = path.resolve(cwd, PROGRESS_FILE);
  try { fs.writeFileSync(progressPath, '', 'utf8'); } catch { /* tolerate */ }
}

export function emitProgress(event: Record<string, unknown>): void {
  if (!progressPath) return;
  const line = JSON.stringify({ ...event, ts: new Date().toISOString() });
  try { fs.appendFileSync(progressPath, line + '\n', 'utf8'); } catch { /* tolerate */ }
}

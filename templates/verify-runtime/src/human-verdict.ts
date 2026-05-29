import { Page } from '@playwright/test';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { recordVerdict, getCurrentScenarioFile } from './verdict-recorder.js';
import { emitProgress } from './progress.js';
import { getFreshPass } from './fresh-pass-cache.js';
import { computePathHash } from './path-hash.js';
import { out } from './output.js';

export type HumanVerdictChar = 'P' | 'I' | 'S' | 'N';

export interface HumanVerdictResult {
  verdict: HumanVerdictChar;
  notes: string;
}

const VALID: HumanVerdictChar[] = ['P', 'I', 'S', 'N'];

/**
 * Pause the run, take a screenshot, open it in the macOS Preview app,
 * prompt the user via stdin for a verdict + optional notes, record the
 * verdict to the ledger, and return.
 *
 * Hard-fails if stdin is not a TTY — silently skipping every human
 * verdict in CI is the worst possible failure mode (false-green).
 *
 * Prompt is written to stderr so Cucumber's stdout formatter doesn't
 * interleave with it.
 */
export async function askHumanVerdict(
  page: Page,
  checkId: string,
  description: string,
  options?: {
    acItemId?: string | null;
    /** Files downloaded by the harness in this scenario so far. The
     *  human-verdict prompt surfaces them as clickable links so checks
     *  like 1.30 (Open the downloaded HTML) and 1.32 (Open the
     *  downloaded PDF) have a path to click. (act:0ac07d6f.) */
    downloads?: ReadonlyArray<{ name: string; path: string }>;
  }
): Promise<HumanVerdictResult> {
  // Compute path-aware hash for cache lookup and recording. If
  // scenarioFile is unset (caller invoked outside a scenario context),
  // pathHash stays empty and the fresh-pass lookup is skipped.
  const scenarioFile = getCurrentScenarioFile();
  let pathHash = '';
  if (scenarioFile) {
    try {
      pathHash = computePathHash(scenarioFile, checkId);
    } catch (err) {
      // Step not found in the .feature, file unreadable, or unparseable.
      // Continue without pathHash — the operator still gets prompted;
      // we just can't dedupe against prior runs.
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${out.c.yellow('⚠')} path-hash unavailable for ${checkId}: ${msg}\n`);
    }
  }

  // Skip-fresh-passes path: when CABINET_VERIFY_SKIP_FRESH_PASSES=1, look
  // up prior human verdicts for this (scenarioFile, checkId, pathHash)
  // and short-circuit the prompt if the most recent is human:P or
  // human:N. Auto-records a human:S row so the run report still has
  // full coverage but the operator's time goes to fresh+failing items
  // only. Checked BEFORE the AUTO_SKIP escape hatch so smoke runs
  // (which ignore everything) are unchanged.
  const fresh = scenarioFile && pathHash ? getFreshPass(scenarioFile, checkId, pathHash) : null;
  if (fresh) {
    const dateShort = fresh.runStartedAt.slice(0, 10);
    const shaShort = (fresh.gitSha || '').slice(0, 8);
    const verdictChar = fresh.verdict.startsWith('human:')
      ? fresh.verdict.slice('human:'.length)
      : '?';
    out.stepAutoSkip(
      checkId,
      `${description}  ${out.c.dim(`(fresh ${verdictChar} from ${dateShort} @ ${shaShort})`)}`,
    );
    await recordVerdict({
      checkId,
      stepText: `human-verdict (skipped — fresh pass): ${description}`,
      verdict: 'human:S',
      source: 'human',
      pathHash,
      notes: `SKIP_FRESH_PASSES=1; prior ${fresh.verdict} on ${dateShort} @ ${shaShort}`,
      durationMs: 0,
      acItemId: options?.acItemId ?? null,
    });
    return { verdict: 'S', notes: 'SKIP_FRESH_PASS' };
  }

  // Smoke-test escape hatch: when CABINET_VERIFY_AUTO_SKIP_HUMAN=1, every
  // human verdict is auto-recorded as 'human:S' (skip) so the harness
  // can be exercised end-to-end without an operator. Use ONLY for
  // structural smoke; never for real verification.
  if (process.env.CABINET_VERIFY_AUTO_SKIP_HUMAN === '1') {
    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    const safeName = checkId.replace(/[^\w.-]/g, '_').slice(0, 80);
    const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      // page may be in a weird state during smoke; tolerate
    }
    out.stepAutoSkip(checkId, description);
    await recordVerdict({
      checkId,
      stepText: `human-verdict (auto-skipped): ${description}`,
      verdict: 'human:S',
      source: 'human',
      screenshotPath,
      pathHash,
      notes: 'AUTO_SKIP=1 (smoke run)',
      durationMs: 0,
      acItemId: options?.acItemId ?? null,
    });
    return { verdict: 'S', notes: 'AUTO_SKIP' };
  }

  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });
  const safeName = checkId.replace(/[^\w.-]/g, '_').slice(0, 80);
  const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);

  const t0 = Date.now();
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const stats = await fs.stat(screenshotPath);
  if (stats.size < 1024) {
    throw new Error(
      `Screenshot ${screenshotPath} is ${stats.size} bytes — too small. ` +
        `Page may not have rendered. Investigate before continuing.`
    );
  }

  // ── Non-TTY path: file-based IPC ──────────────────────────────────
  // When running from Claude Code's Bash tool (no interactive stdin),
  // write a pending-verdict file and poll for a response file. The
  // skill orchestrator reads the pending file, presents the screenshot
  // to the user in the conversation, collects the verdict, and writes
  // the response file. This lets the skill own the full lifecycle
  // without requiring the user to run commands via `!`.
  if (!process.stdin.isTTY) {
    const pendingPath = path.resolve(process.cwd(), '.verdict-pending.json');
    const responsePath = path.resolve(process.cwd(), '.verdict-response.json');

    try { await fs.unlink(responsePath); } catch { /* may not exist */ }

    await fs.writeFile(pendingPath, JSON.stringify({
      checkId,
      description,
      screenshotPath: path.resolve(screenshotPath),
      pathHash,
      acItemId: options?.acItemId ?? null,
    }), 'utf8');

    emitProgress({ event: 'verdict-pending', checkId, description, screenshotPath: path.resolve(screenshotPath) });
    process.stderr.write(`\n  ${out.c.yellow('⏳')} Waiting for verdict on ${out.c.bold(checkId)} via file IPC...\n`);

    // Poll for response (500ms intervals, 10 min timeout)
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const raw = await fs.readFile(responsePath, 'utf8');
        const resp = JSON.parse(raw);
        await fs.unlink(responsePath).catch(() => {});
        await fs.unlink(pendingPath).catch(() => {});

        const verdict = (String(resp.verdict).charAt(0).toUpperCase()) as HumanVerdictChar;
        if (!VALID.includes(verdict)) {
          throw new Error(`Invalid verdict "${resp.verdict}" in .verdict-response.json`);
        }
        const respNotes = String(resp.notes ?? '').trim();
        const durationMs = Date.now() - t0;

        await recordVerdict({
          checkId,
          stepText: `human-verdict: ${description}`,
          verdict: `human:${verdict}`,
          source: 'human',
          screenshotPath,
          pathHash,
          notes: respNotes || null,
          durationMs,
          acItemId: options?.acItemId ?? null,
        });

        out.humanRecorded(verdict, respNotes);
        return { verdict, notes: respNotes };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }

    // Timeout — auto-skip so the run doesn't hang forever
    await fs.unlink(pendingPath).catch(() => {});
    process.stderr.write(`  ${out.c.red('⏰')} Verdict timeout for ${checkId} — auto-skipping\n`);
    await recordVerdict({
      checkId,
      stepText: `human-verdict (IPC timeout): ${description}`,
      verdict: 'human:S',
      source: 'human',
      screenshotPath,
      pathHash,
      notes: 'IPC timeout (10 min) — no response file written',
      durationMs: Date.now() - t0,
      acItemId: options?.acItemId ?? null,
    });
    return { verdict: 'S', notes: 'IPC_TIMEOUT' };
  }

  // ── TTY path: interactive readline prompt ─────────────────────────
  if (process.env.CABINET_VERIFY_AUTO_OPEN_SCREENSHOTS === '1') {
    spawn('open', [screenshotPath], { detached: true, stdio: 'ignore' }).unref();
    await new Promise((r) => setTimeout(r, 300));
  }

  out.humanPrompt(checkId, description, screenshotPath, options?.downloads);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });

  const line = await new Promise<string>((resolve) => {
    rl.question('', (answer) => resolve(answer));
  });
  rl.close();

  const trimmed = line.trim();
  const first = trimmed.charAt(0).toUpperCase() as HumanVerdictChar;
  if (!VALID.includes(first)) {
    out.humanInvalidVerdict(trimmed);
    return askHumanVerdict(page, checkId, description, options);
  }

  const notes = trimmed.slice(1).trim();
  const durationMs = Date.now() - t0;

  await recordVerdict({
    checkId,
    stepText: `human-verdict: ${description}`,
    verdict: `human:${first}`,
    source: 'human',
    screenshotPath,
    pathHash,
    notes: notes || null,
    durationMs,
    acItemId: options?.acItemId ?? null,
  });

  out.humanRecorded(first, notes);

  return { verdict: first, notes };
}

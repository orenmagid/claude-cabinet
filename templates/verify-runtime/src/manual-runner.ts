/**
 * Manual-checklist runner.
 *
 * For scenarios that can't be Playwright-driven — iPhone scenarios
 * (Playwright doesn't run iOS Safari) and local-dev scenarios
 * (kill -9 the backend, etc.) — we walk the user through a Markdown
 * checklist via the same stdin verdict pattern the @desktop scenarios
 * use. The harness orchestrates the prompt + verdict capture; the
 * user does the actual driving.
 *
 * Markdown format the parser expects:
 *
 *     # Scenario 7 — iPhone first-impression sign-in
 *
 *     Optional preamble paragraph (any text before the first `##`).
 *
 *     ## 7.01 — Open desicify in mobile Safari
 *     Do: open https://desicify.com on your iPhone
 *     Expect: landing renders, no horizontal scroll, hero legible
 *
 *     ## 7.02 — Tap Sign in
 *     Do: ...
 *     Expect: ...
 *
 * Each `## ID — Title` block becomes one verdict prompt. The
 * `Do:` / `Expect:` lines (case-insensitive, optional) are surfaced
 * verbatim. Anything after them in the block is shown as additional
 * context. ID is the leading non-whitespace token of the heading
 * (e.g. "7.01"); Title is the rest of the heading.
 *
 * Verdict char drives the same ledger as `askHumanVerdict` —
 * `human:P` / `human:I` / `human:S` / `human:N` — so `report:last`
 * surfaces I-verdicts and auto-fails uniformly across @desktop and
 * @manual scenarios.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { recordVerdict, getCurrentScenarioFile } from './verdict-recorder.js';
import { getFreshPass } from './fresh-pass-cache.js';
import { computePathHash } from './path-hash.js';
import { out } from './output.js';

export type ManualVerdictChar = 'P' | 'I' | 'S' | 'N';
const VALID: ManualVerdictChar[] = ['P', 'I', 'S', 'N'];

export interface ManualChecklistItem {
  id: string;
  title: string;
  doLine: string | null;
  expectLine: string | null;
  /** Any extra context lines after Do/Expect, joined with newlines. */
  extra: string;
}

export function parseManualChecklist(markdown: string): ManualChecklistItem[] {
  const items: ManualChecklistItem[] = [];
  // Split on `## ` at line starts. The first chunk (preamble + h1) is
  // discarded — we only care about the per-item `##` blocks.
  const blocks = markdown.split(/\n##\s+/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;
    const firstNewline = block.indexOf('\n');
    const heading = firstNewline === -1 ? block : block.slice(0, firstNewline).trim();
    const body = firstNewline === -1 ? '' : block.slice(firstNewline + 1).trim();

    // Heading shape: "ID — Title" or "ID Title". Split on the first
    // em-dash, en-dash, or hyphen-space.
    const headingMatch = heading.match(/^(\S+)\s*[—–-]\s*(.*)$/);
    const id = headingMatch ? headingMatch[1] : heading.split(/\s+/)[0];
    const title = headingMatch ? headingMatch[2].trim() : heading.slice(id.length).trim();

    let doLine: string | null = null;
    let expectLine: string | null = null;
    const extraLines: string[] = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (/^do:/i.test(trimmed) && doLine === null) {
        doLine = trimmed.replace(/^do:\s*/i, '').trim();
      } else if (/^expect:/i.test(trimmed) && expectLine === null) {
        expectLine = trimmed.replace(/^expect:\s*/i, '').trim();
      } else if (trimmed) {
        extraLines.push(trimmed);
      }
    }

    items.push({
      id,
      title,
      doLine,
      expectLine,
      extra: extraLines.join('\n'),
    });
  }
  return items;
}

/**
 * Walk the user through a Markdown checklist file. Each item gets a
 * stdin prompt + verdict capture. Hard-fails if stdin isn't a TTY,
 * UNLESS CABINET_VERIFY_AUTO_SKIP_HUMAN=1 is set — then every item
 * auto-records as `human:S` so the structural smoke can run end-to-end.
 *
 * `scenarioRole` is recorded with each verdict so the report can
 * group manual scenarios alongside the desktop @as-user / @as-admin
 * scenarios consistently. Pass null for environment-only manual
 * scenarios (e.g. local-dev kill-9 tests) where no role applies.
 */
export async function walkManualChecklist(
  markdownPath: string,
  scenarioRole: string | null = null,
): Promise<void> {
  const absPath = path.resolve(process.cwd(), markdownPath);
  const markdown = await fs.readFile(absPath, 'utf8');
  const items = parseManualChecklist(markdown);
  if (items.length === 0) {
    throw new Error(`Manual checklist ${markdownPath} produced 0 items — wrong format?`);
  }

  // Smoke escape hatch — same env var the human-verdict path checks.
  if (process.env.CABINET_VERIFY_AUTO_SKIP_HUMAN === '1') {
    for (const item of items) {
      const desc = `${item.title} — Do: ${item.doLine ?? '(none)'} | Expect: ${
        item.expectLine ?? '(none)'
      }`;
      out.stepAutoSkip(item.id, desc);
      await recordVerdict({
        checkId: item.id,
        stepText: `manual-checklist (auto-skipped): ${desc}`,
        verdict: 'human:S',
        source: 'human',
        notes: 'AUTO_SKIP=1 (smoke run)',
        durationMs: 0,
      });
    }
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `Manual checklist ${markdownPath} requires a TTY for verdict input. ` +
        `Run interactively, or set CABINET_VERIFY_AUTO_SKIP_HUMAN=1 for a structural smoke.`,
    );
  }

  const scenarioFile = getCurrentScenarioFile();
  for (const item of items) {
    // Compute path-aware hash for this checklist item. Manual checklists
    // live in markdown, not .feature files — so when the scenarioFile is
    // a real .feature path containing the manual step, pathHash works
    // as expected. When the manual scenario is markdown-only (no
    // covering Gherkin step), pathHash falls back to empty and the
    // fresh-pass lookup is skipped (the operator gets prompted; no
    // dedup possible).
    let pathHash = '';
    if (scenarioFile) {
      try {
        pathHash = computePathHash(scenarioFile, item.id);
      } catch {
        // markdown-only manual scenarios won't have a feature step.
        // Quiet — this is expected for many manual flows.
        pathHash = '';
      }
    }

    // Skip-fresh-passes (same contract as human-verdict.ts). If the
    // operator already P-verdicted this manual item recently AND the
    // pathHash matches, don't make them retype.
    const fresh = scenarioFile && pathHash ? getFreshPass(scenarioFile, item.id, pathHash) : null;
    if (fresh) {
      const dateShort = fresh.runStartedAt.slice(0, 10);
      const shaShort = (fresh.gitSha || '').slice(0, 8);
      const verdictChar = fresh.verdict.startsWith('human:')
        ? fresh.verdict.slice('human:'.length)
        : '?';
      out.stepAutoSkip(
        item.id,
        `${item.title}  ${out.c.dim(`(fresh ${verdictChar} from ${dateShort} @ ${shaShort})`)}`,
      );
      await recordVerdict({
        checkId: item.id,
        stepText: `manual-checklist [${scenarioRole ?? 'env'}] (skipped — fresh pass): ${item.title}`,
        verdict: 'human:S',
        source: 'human',
        pathHash,
        notes: `SKIP_FRESH_PASSES=1; prior ${fresh.verdict} on ${dateShort} @ ${shaShort}`,
        durationMs: 0,
      });
      continue;
    }

    const t0 = Date.now();
    promptManualItem(item);
    const verdict = await readVerdict();
    const durationMs = Date.now() - t0;
    await recordVerdict({
      checkId: item.id,
      stepText: `manual-checklist [${scenarioRole ?? 'env'}]: ${item.title}`,
      verdict: `human:${verdict.char}`,
      source: 'human',
      pathHash,
      notes: verdict.notes || null,
      durationMs,
    });
    out.humanRecorded(verdict.char, verdict.notes);
  }
}

function promptManualItem(item: ManualChecklistItem): void {
  // Re-uses output.ts's humanPrompt-like layout for visual consistency
  // with @desktop human verdicts. No screenshot path because the user
  // is looking at their phone (or local terminal), not a Playwright
  // viewport.
  process.stderr.write('\n');
  process.stderr.write(`  ▸ ${item.id}  ${item.title}\n`);
  if (item.doLine) {
    process.stderr.write(`      Do:     ${item.doLine}\n`);
  }
  if (item.expectLine) {
    process.stderr.write(`      Expect: ${item.expectLine}\n`);
  }
  if (item.extra) {
    for (const line of item.extra.split('\n')) {
      process.stderr.write(`              ${line}\n`);
    }
  }
  process.stderr.write(
    `      Verdict (P=pass / I=issues / S=skip / N=note): `,
  );
}

interface VerdictReply {
  char: ManualVerdictChar;
  notes: string;
}

async function readVerdict(): Promise<VerdictReply> {
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
  const first = trimmed.charAt(0).toUpperCase() as ManualVerdictChar;
  if (!VALID.includes(first)) {
    out.humanInvalidVerdict(trimmed);
    return readVerdict();
  }
  const notes = trimmed.slice(1).trim();
  return { char: first, notes };
}

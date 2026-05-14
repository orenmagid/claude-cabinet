#!/usr/bin/env node
/**
 * Print the most recent verification run's human verdicts, grouped by
 * verdict char. Run after every interactive scenario so I-verdicts
 * (real issues) get surfaced and P/N notes (FYI context) don't
 * accumulate on disk unread.
 *
 * Usage:
 *   cabinet-verify-report-last            # latest run by mtime
 *   cabinet-verify-report-last <runId>    # specific run
 *   cabinet-verify-report-last --help
 *
 * Convention (codified in CONVENTIONS.md §Verdict Chars): the verdict
 * char is authoritative — P notes are FYI not action items, only I
 * notes are filed as issues by the consuming project.
 */
import * as fs from 'fs';
import * as path from 'path';
import pc from 'picocolors';
import terminalLink from 'terminal-link';

const REPORTS = path.resolve(process.cwd(), 'reports');

function printHelp(): void {
  process.stdout.write(
    `cabinet-verify-report-last — print last run's verdicts grouped by char.\n\n` +
      `Usage:\n` +
      `  cabinet-verify-report-last              latest run (most recent mtime)\n` +
      `  cabinet-verify-report-last <runId>      specific run by ID\n` +
      `  cabinet-verify-report-last --help       this message\n\n` +
      `Reads ./reports/<runId>.summary.json. I-verdicts and auto-fail rows are\n` +
      `surfaced first; P/N notes are de-emphasised.\n`,
  );
}

function fileLink(absPath: string, label?: string): string {
  const url = `file://${absPath}`;
  const text = label ?? absPath;
  return terminalLink(text, url, { fallback: () => text });
}

function findReport(arg?: string): string {
  if (!fs.existsSync(REPORTS)) {
    process.stderr.write(pc.red(`No reports directory at ${REPORTS}. Run a scenario first.\n`));
    process.exit(1);
  }
  if (arg) {
    const target = arg.endsWith('.summary.json') ? arg : `${arg}.summary.json`;
    const full = path.resolve(REPORTS, target);
    if (!fs.existsSync(full)) {
      process.stderr.write(pc.red(`Report not found: ${full}\n`));
      process.exit(1);
    }
    return full;
  }
  const candidates = fs
    .readdirSync(REPORTS)
    .filter((n) => n.endsWith('.summary.json'))
    .map((n) => ({
      name: n,
      full: path.join(REPORTS, n),
      mtime: fs.statSync(path.join(REPORTS, n)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) {
    process.stderr.write(pc.red(`No .summary.json files in ${REPORTS}.\n`));
    process.exit(1);
  }
  return candidates[0].full;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const reportPath = findReport(args[0]);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const cols = process.stderr.columns ?? 80;
const hr = '═'.repeat(cols);

console.log();
console.log(pc.bold(pc.cyan(hr)));
console.log(pc.bold(pc.cyan(`  ${report.runId}`)));
console.log(pc.dim(`  git    ${(report.rows[0]?.gitSha ?? 'unknown').slice(0, 8)}`));
console.log(pc.dim(`  file   ${fileLink(reportPath, path.basename(reportPath))}`));
console.log(pc.bold(pc.cyan(hr)));
console.log();

// Summary line
const failColor = report.failed > 0 ? pc.red : pc.dim;
console.log(
  `  ${pc.dim('total')} ${pc.bold(String(report.total))}` +
    `   ${pc.green('✓ ' + report.passed)}` +
    `   ${failColor('✗ ' + report.failed)}` +
    `   ${pc.yellow('? ' + report.humanVerdicts)}`,
);
console.log();

interface VerdictRow {
  source: 'auto' | 'human';
  verdict: string;
  checkId: string;
  stepText?: string;
  notes?: string | null;
  screenshotPath?: string | null;
}

// Group human rows by verdict
const buckets: Record<'P' | 'I' | 'S' | 'N', VerdictRow[]> = { P: [], I: [], S: [], N: [] };
for (const row of report.rows as VerdictRow[]) {
  if (row.source !== 'human') continue;
  const m = String(row.verdict).match(/^human:([PISN])$/);
  if (!m) continue;
  // Skip auto-skip rows from smoke runs — uninteresting noise.
  const notes = (row.notes ?? '').trim();
  if (notes === 'AUTO_SKIP') continue;
  buckets[m[1] as 'P' | 'I' | 'S' | 'N'].push(row);
}

interface SectionStyle {
  color: (s: string) => string;
  label: string;
  emoji: string;
}

const sectionStyle: Record<'P' | 'I' | 'S' | 'N', SectionStyle> = {
  I: { color: pc.red, label: 'I = ISSUES (action items)', emoji: '✗' },
  N: { color: pc.cyan, label: 'N = PASS WITH OBSERVATION (forward-looking)', emoji: '✎' },
  P: { color: pc.green, label: 'P = PASS (notes are FYI, not action items)', emoji: '✓' },
  S: { color: pc.dim, label: 'S = SKIP', emoji: '⊘' },
};

// Print order: Issues first (most actionable), then N, P, S.
for (const v of ['I', 'N', 'P', 'S'] as const) {
  const rows = buckets[v];
  if (rows.length === 0) continue;
  const { color, label, emoji } = sectionStyle[v];
  console.log(
    pc.bold(color(`── ${label} (${rows.length}) ${'─'.repeat(Math.max(3, cols - label.length - 12))}`)),
  );
  console.log();
  for (const row of rows) {
    const cid = pc.bold(color(`${emoji} ${row.checkId}`));
    const stepText = (row.stepText || '').replace(/^human-verdict:\s*/, '');
    console.log(`  ${cid}  ${pc.dim(stepText.slice(0, cols - 8))}`);
    if (row.notes && row.notes.trim()) {
      const notes = row.notes.trim();
      const indent = '      ';
      const maxWidth = cols - indent.length;
      const wrapped = notes.match(new RegExp(`.{1,${maxWidth}}(\\s|$)`, 'g')) || [notes];
      for (const line of wrapped) {
        console.log(indent + pc.italic(color(line.trimEnd())));
      }
    }
    if (row.screenshotPath) {
      console.log(
        `      ${pc.dim('shot ')} ${fileLink(row.screenshotPath, path.basename(row.screenshotPath))}`,
      );
    }
    console.log();
  }
}

// Surface auto-fail rows (the harness flagged something).
const autoFails = (report.rows as VerdictRow[]).filter((r) => r.verdict === 'auto:fail');
if (autoFails.length > 0) {
  console.log(
    pc.bold(pc.red(`── auto-fail (${autoFails.length}) — harness flagged ${'─'.repeat(Math.max(3, cols - 50))}`)),
  );
  console.log();
  for (const row of autoFails) {
    console.log(`  ${pc.bold(pc.red('✗ ' + row.checkId))}  ${pc.dim((row.stepText || '').slice(0, cols - 8))}`);
    if (row.notes) {
      const indent = '      ';
      const maxWidth = cols - indent.length;
      const wrapped = String(row.notes).slice(0, 600).match(new RegExp(`.{1,${maxWidth}}(\\s|$)`, 'g')) || [
        row.notes,
      ];
      for (const line of wrapped) console.log(indent + pc.red(line.trimEnd()));
    }
    console.log();
  }
}

console.log(pc.dim("  Convention: only I-verdicts and auto-fail rows are filed as issues."));
console.log(pc.dim('  P/N notes are FYI context that surfaced something subtle — log it,'));
console.log(pc.dim("  but trust the verdict char (the user's deliberate choice) over note tone."));
console.log();

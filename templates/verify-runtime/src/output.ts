/**
 * Centralized terminal output: colors, clickable links, boxed prompts.
 *
 * Writes ALL output to stderr — Cucumber's stdout formatter doesn't
 * intercept stderr, so our scenario chrome and human-verdict prompts
 * never get clobbered by progress dots or summary tables.
 *
 * If stderr isn't a TTY (CI, piped output), picocolors auto-disables
 * ANSI escapes, terminal-link uses its fallback (text only), and boxen
 * still renders Unicode borders (acceptable in plain logs).
 */

import pc from 'picocolors';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import { resolve } from 'path';

const W = (s: string): void => {
  process.stderr.write(s);
};
const WL = (s: string = ''): void => {
  process.stderr.write(s + '\n');
};

const cols = (): number => process.stderr.columns ?? 80;

const hr = (char: string = '─', width?: number): string =>
  char.repeat(Math.max(20, width ?? cols()));

/** Make an absolute file path into a clickable terminal link.
 *  In a TTY: OSC 8 link with `label` as visible text, target file://abs.
 *  Outside a TTY (piped output, CI logs): renders as the label only —
 *  the full path is recoverable from the JSONL ledger if needed. */
function fileLink(absPath: string, label?: string): string {
  const url = `file://${absPath}`;
  const text = label ?? absPath;
  return terminalLink(text, url, { fallback: () => text });
}

/**
 * Strip checkId prefix from step text, returning the human-readable
 * description. Input shapes:
 *   'check "1.04 heading-visible" the workspace heading is visible'
 *   → 'the workspace heading is visible'
 *   'I navigate to "/app"'
 *   → 'I navigate to "/app"' (no checkId to strip)
 */
export function narrateStep(stepText: string): string {
  const checkPattern = /^check\s+"[^"]+"\s+/;
  return stepText.replace(checkPattern, '').trim();
}

export const out = {
  // ─── Run-level chrome ─────────────────────────────────────────────
  runStart(runId: string, gitSha: string, jsonlPath: string): void {
    const ledgerName = jsonlPath.split('/').pop() ?? jsonlPath;
    WL();
    WL(pc.bold(pc.cyan('═'.repeat(cols()))));
    WL(pc.bold(pc.cyan(`  RUN START  ${runId}`)));
    WL(pc.dim(`  git    ${gitSha.slice(0, 8)}`));
    WL(pc.dim(`  ledger ${fileLink(jsonlPath, ledgerName)}`));
    WL(pc.bold(pc.cyan('═'.repeat(cols()))));
    WL();
  },

  runSummary(args: {
    runId: string;
    total: number;
    passed: number;
    failed: number;
    humanVerdicts: number;
    summaryPath: string;
  }): void {
    const status = args.failed === 0 ? pc.bold(pc.green('✓ PASSED')) : pc.bold(pc.red('✗ FAILED'));
    const body =
      `${pc.bold('Run summary')}  ${status}\n\n` +
      `  ${pc.dim('total ')}${pc.bold(String(args.total))}` +
      `   ${pc.green('✓ ' + args.passed)}` +
      `   ${args.failed > 0 ? pc.red('✗ ' + args.failed) : pc.dim('✗ 0')}` +
      `   ${pc.yellow('? ' + args.humanVerdicts)}\n\n` +
      `  ${pc.dim('report ')} ${fileLink(args.summaryPath, args.summaryPath.split('/').pop() ?? args.summaryPath)}`;
    WL();
    WL(boxen(body, {
      padding: 1,
      borderStyle: 'round',
      borderColor: args.failed === 0 ? 'green' : 'red',
      title: args.runId,
      titleAlignment: 'center',
    }));
    WL();
  },

  // ─── Scenario divider ─────────────────────────────────────────────
  scenarioStart(name: string, featureFile: string): void {
    const headerText = ` Scenario: ${name} `;
    const sidePad = Math.max(3, Math.floor((cols() - headerText.length) / 2));
    const left = '─'.repeat(sidePad);
    const right = '─'.repeat(Math.max(3, cols() - sidePad - headerText.length));
    WL();
    WL(pc.bold(pc.magenta(`${left}${headerText}${right}`)));
    WL(pc.dim(`  ${fileLink(resolve(process.cwd(), featureFile))}`));
    WL();
  },

  // ─── Step-level output ────────────────────────────────────────────
  stepStart(checkId: string, description: string): void {
    // Indented under scenario divider; checkId in cyan, desc in dim.
    WL(`  ${pc.cyan('▸')} ${pc.cyan(checkId)}  ${pc.dim(description)}`);
  },
  stepPass(durationMs: number, notes?: string | null): void {
    const ms = pc.dim(`(${durationMs}ms)`);
    const trailing = notes ? `  ${pc.dim(notes)}` : '';
    WL(`    ${pc.green('✓ pass')} ${ms}${trailing}`);
  },
  stepFail(durationMs: number, msg: string): void {
    const ms = pc.dim(`(${durationMs}ms)`);
    // Truncate failure msg to keep one-liner; full stack is in the report.
    const short = msg.length > cols() - 25 ? msg.slice(0, cols() - 28) + '...' : msg;
    WL(`    ${pc.red(pc.bold('✗ FAIL'))} ${ms}  ${pc.red(short)}`);
  },
  stepAutoSkip(checkId: string, description: string): void {
    WL(`    ${pc.dim('⊘')} ${pc.dim(checkId)}  ${pc.dim('AUTO-SKIPPED  ' + description.slice(0, 60))}`);
  },

  // Special: rewrite-completion's variable wall-clock
  rewriteCompleted(seconds: number): void {
    WL(`    ${pc.green('✓ rewrite completed in')} ${pc.bold(pc.green(seconds.toFixed(1) + 's'))}`);
  },

  // ─── Human verdict prompt + recording ─────────────────────────────
  humanPrompt(
    checkId: string,
    description: string,
    screenshotPath: string,
    downloads?: ReadonlyArray<{ name: string; path: string }>
  ): void {
    const downloadsBlock =
      downloads && downloads.length > 0
        ? `\n${pc.dim('files')}  ` +
          downloads
            .map((d) => fileLink(d.path, d.name))
            .join(`\n        `)
        : '';
    const rendered = boxen(
      `${pc.bold(pc.yellow('HUMAN VERDICT REQUIRED'))}\n\n` +
        `${pc.dim('check')}  ${pc.bold(checkId)}\n` +
        `${pc.dim('ask  ')}  ${description}\n` +
        `${pc.dim('shot ')}  ${fileLink(screenshotPath, screenshotPath.split('/').pop() ?? screenshotPath)}` +
        downloadsBlock +
        `\n\n` +
        `${pc.dim('P')}=${pc.green('pass')}  ${pc.dim('|')}  ${pc.dim('I')}=${pc.red('issues')}  ${pc.dim('|')}  ${pc.dim('S')}=${pc.dim('skip')}  ${pc.dim('|')}  ${pc.dim('N')}=${pc.cyan('note')}\n` +
        `${pc.dim('Type one letter, optionally followed by a space + your note.')}\n` +
        `${pc.dim('Examples:  ')}${pc.italic(pc.dim('P'))}${pc.dim('     ')}${pc.italic(pc.dim('P looks great'))}${pc.dim('     ')}${pc.italic(pc.dim('I tab title freezes mid-stream'))}`,
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 0, left: 2, right: 0 },
        borderStyle: 'round',
        borderColor: 'yellow',
      }
    );
    WL();
    WL(rendered);
    W('  ' + pc.bold(pc.yellow('> ')));
  },
  humanInvalidVerdict(input: string): void {
    WL('  ' + pc.red(`✗ invalid verdict "${input}" — expected P/I/S/N as first char. Try again.`));
  },
  humanRecorded(verdictChar: 'P' | 'I' | 'S' | 'N', notes: string): void {
    const colorFn = { P: pc.green, I: pc.red, S: pc.dim, N: pc.cyan }[verdictChar];
    const label = `human:${verdictChar}`;
    const trailing = notes ? `  ${pc.dim('—')}  ${pc.italic(`"${notes}"`)}` : '';
    WL(`  ${pc.green('✓ recorded')} ${pc.bold(colorFn(label))}${trailing}`);
    WL();
  },

  // ─── Background / preflight messages ──────────────────────────────
  preflightLine(ok: boolean, msg: string): void {
    const mark = ok ? pc.green('✓') : pc.red('✗');
    WL(`  ${mark} ${ok ? msg : pc.red(msg)}`);
  },

  // ─── Raw write helpers (for callers that need full control) ───────
  writeln: WL,
  write: W,
  // Re-export pc so callers can compose ad-hoc styles
  c: pc,
  link: fileLink,
};

export default out;

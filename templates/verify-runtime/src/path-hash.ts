/**
 * pathHash — content-aware hash of the scenario path leading to a step.
 *
 * See CONVENTIONS.md §pathHash Spec for the frozen contract.
 *
 * Summary: parse the .feature file, find the scenario containing the
 * step whose checkId matches the input, collect all step texts from
 * scenario start through (and including) the target, newline-join,
 * sha256, truncate to first 16 hex chars. Background steps are NOT
 * included.
 *
 * The checkId-to-step matching uses a two-strategy lookup that mirrors
 * the de[sic]ify Gherkin conventions:
 *   1. Quoted-arg form: `check "1.04 ..."` or `ask the human "1.04 ..."`
 *      — extract the first quoted string, take its leading token.
 *   2. Bare-leading-token form: step text starts with the token directly
 *      (e.g., `1.04 the user signs in`).
 *
 * The runtime accepts either form; the parser tries quoted first, then
 * bare.
 */

import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument, type Step } from '@cucumber/messages';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

/**
 * Sentinel thrown when the feature file itself is unparseable by
 * @cucumber/gherkin. Distinct from "step not found" so callers can
 * differentiate corrupt-feature (operator should fix) from removed-
 * step (legacy ledger row referring to a step that no longer exists,
 * which is expected during normal evolution).
 */
export class GherkinParseError extends Error {
  constructor(message: string, public readonly scenarioFile: string) {
    super(message);
    this.name = 'GherkinParseError';
  }
}

interface CachedDoc {
  doc: GherkinDocument;
  sourceHash: string;
}

const docCache = new Map<string, CachedDoc>();

function parseFeature(scenarioFile: string): GherkinDocument {
  // Cache by content hash (not mtime). mtime resolution on macOS HFS+ is
  // 1s; APFS is finer but writeFileSync followed by statSync within the
  // same tick can return identical mtime. Content-hashing avoids the
  // stale-cache failure mode and parse cost for small .feature files is
  // negligible compared to the sha256.
  const source = fs.readFileSync(scenarioFile, 'utf8');
  const sourceHash = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const cached = docCache.get(scenarioFile);
  if (cached && cached.sourceHash === sourceHash) {
    return cached.doc;
  }
  const parser = new Parser(
    new AstBuilder(IdGenerator.uuid()),
    new GherkinClassicTokenMatcher(),
  );
  let doc: GherkinDocument;
  try {
    doc = parser.parse(source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GherkinParseError(
      `Failed to parse ${scenarioFile}: ${msg}`,
      scenarioFile,
    );
  }
  docCache.set(scenarioFile, { doc, sourceHash });
  return doc;
}

/**
 * Extract the leading non-whitespace token from a string. Returns the
 * token verbatim (no normalization); empty string if input is empty.
 */
function leadingToken(s: string): string {
  const match = s.match(/^\s*(\S+)/);
  return match ? match[1] : '';
}

/**
 * Try to extract the checkId from a step's text using the two-strategy
 * lookup. Returns the candidate checkId or null if neither form matches.
 *
 * Quoted strategy: find the first `"..."` group in the step text, return
 * the leading token of the quoted content. Used by `check "NN.NN ..."`
 * and `ask the human "NN.NN ..."` step shapes.
 *
 * Bare strategy: return the leading token of the step text itself. Used
 * by step shapes that embed the checkId directly (`Given NN.NN ...`).
 */
export function extractCheckIdFromStep(stepText: string): string | null {
  const quotedMatch = stepText.match(/"([^"]*)"/);
  if (quotedMatch) {
    const inner = leadingToken(quotedMatch[1]);
    if (inner) return inner;
  }
  const bare = leadingToken(stepText);
  return bare || null;
}

/**
 * Step text considered for pathHash input. Includes any inline DocString
 * or DataTable content appended with `\n` separators in Gherkin emit
 * order. Background steps are excluded by the caller (this function is
 * only invoked on scenario-internal steps).
 */
function stepHashableText(step: Step): string {
  const parts: string[] = [`${step.keyword.trim()} ${step.text}`];
  if (step.docString) {
    parts.push(step.docString.content);
  }
  if (step.dataTable) {
    for (const row of step.dataTable.rows) {
      parts.push(row.cells.map((c) => c.value).join('|'));
    }
  }
  return parts.join('\n');
}

/**
 * Compute the pathHash for a step identified by checkId within
 * scenarioFile. Throws if the file can't be read or parsed, or if no
 * step matches the checkId.
 *
 * Returns the first 16 hex chars of sha256(joined-step-texts), where
 * joined-step-texts is the newline-joined hashable text of every step
 * in the scenario from the first through (and including) the matching
 * step.
 *
 * Note: hashes are STABLE across invocations within a process for the
 * same file (cached by mtime). They will RECOMPUTE after the file is
 * edited (mtime change invalidates the cache entry).
 */
export function computePathHash(scenarioFile: string, checkId: string): string {
  const doc = parseFeature(scenarioFile);
  const feature = doc.feature;
  if (!feature) {
    throw new Error(`path-hash: ${scenarioFile} has no Feature`);
  }

  // Normalize the input checkId to its leading non-whitespace token. The
  // frozen spec (CONVENTIONS.md §CheckId) defines checkId as a single
  // NN.NN token, but real callers sometimes pass a multi-token form like
  // "2.04 history-list-feels-readable" (e.g., the `ask the human` step
  // shape that includes a kebab slug before the colon-delimited
  // description). Normalizing here lets either form match without
  // requiring downstream callers to enforce the convention.
  const normalizedCheckId = leadingToken(checkId);
  if (!normalizedCheckId) {
    throw new Error(`path-hash: empty checkId passed for ${scenarioFile}`);
  }

  // Find ALL matching scenarios (to detect cross-scenario duplicate
  // checkIds, which the spec says is undefined behavior — we treat as
  // an error rather than silently first-match).
  const matches: Array<{ scenarioName: string; steps: readonly Step[]; targetIndex: number }> = [];
  for (const child of feature.children) {
    const scenario = child.scenario;
    if (!scenario) continue;
    // Scenario Outlines have non-empty `examples`. The spec says each
    // example row should produce a distinct pathHash via placeholder
    // substitution. v0.1.0 does not implement per-example hashing —
    // throw a clear error so the operator switches to plain `Scenario:`
    // until Outline support lands. Silent miss-hashing would be worse.
    if (scenario.examples && scenario.examples.length > 0) {
      throw new Error(
        `path-hash: Scenario Outline in ${scenarioFile} (scenario "${scenario.name}") ` +
          `is not yet supported in v0.1.0. Convert to plain Scenario: blocks, or ` +
          `wait for the Outline-aware pathHash variant.`,
      );
    }
    let targetIndex = -1;
    for (let i = 0; i < scenario.steps.length; i++) {
      const extracted = extractCheckIdFromStep(scenario.steps[i].text);
      if (extracted === normalizedCheckId) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex !== -1) {
      matches.push({ scenarioName: scenario.name, steps: scenario.steps, targetIndex });
    }
  }

  if (matches.length === 0) {
    throw new Error(
      `path-hash: no step matching checkId "${normalizedCheckId}" found in ${scenarioFile}` +
        (normalizedCheckId !== checkId ? ` (input checkId was "${checkId}")` : ''),
    );
  }
  if (matches.length > 1) {
    const names = matches.map((m) => `"${m.scenarioName}"`).join(', ');
    throw new Error(
      `path-hash: checkId "${normalizedCheckId}" appears in multiple scenarios in ${scenarioFile} ` +
        `(${names}). CheckIds must be unique across all scenarios in a feature file — ` +
        `rename one of them.`,
    );
  }

  // Hash from scenario start through target (inclusive).
  const { steps, targetIndex } = matches[0];
  const subSteps = steps.slice(0, targetIndex + 1);
  const input = subSteps.map(stepHashableText).join('\n');
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Best-effort variant: returns the hash, or empty string for "expected"
 * misses (file missing, step removed, Outline-still-unsupported,
 * cross-scenario duplicate). Re-throws GherkinParseError so callers
 * can distinguish "feature file got broken" from "step no longer
 * exists" — those have different operator-facing remedies.
 *
 * Used by the fresh-pass cache loader when surfacing legacy ledger
 * rows: a missing/renamed/removed step intentionally invalidates the
 * cache entry, but a corrupt .feature should not silently degrade the
 * entire cache.
 */
export function computePathHashSafe(scenarioFile: string, checkId: string): string {
  try {
    return computePathHash(scenarioFile, checkId);
  } catch (err) {
    if (err instanceof GherkinParseError) {
      throw err;
    }
    return '';
  }
}

/** For testing — clear the in-process cache between feature-edit tests. */
export function _clearPathHashCache(): void {
  docCache.clear();
}

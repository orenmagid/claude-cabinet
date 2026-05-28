// CheckResult — the single normalized shape every site-audit check emits.
//
// This is the contract pinned in Phase 0 before any check module is written.
// All 15 heterogeneous tools (scored 0-100, pass/fail, list-only) normalize to
// this shape so the orchestrator, comparison diff, and HTML report can treat
// every check uniformly.
//
// Two invariants the validator enforces, both load-bearing:
//   1. `status` is NEVER absent. A check that couldn't run is `skip`/`error`
//      with a `reason` — it must never read as a silent `pass`.
//   2. `score: null` is DISTINCT from `score: 0`. null means "this tool
//      produces no score" (e.g. a link checker); 0 means "worst possible
//      score". Collapsing them loses signal, so `undefined` score is invalid.

/**
 * @typedef {'pass'|'fail'|'skip'|'error'} CheckStatus
 * @typedef {'critical'|'serious'|'moderate'|'info'} Severity
 *
 * @typedef {Object} Finding
 * @property {Severity} severity
 * @property {string} message
 * @property {string} [url]
 * @property {string} [context]
 *
 * @typedef {Object} CheckResult
 * @property {string} checkId            Stable id, e.g. 'lighthouse'
 * @property {string} tool               Human tool name, e.g. 'Lighthouse'
 * @property {CheckStatus} status        Never absent
 * @property {number|null} score         0-100, or null when the tool has no score (null !== 0)
 * @property {string|null} grade         e.g. 'A+', or null
 * @property {Severity|null} severity    Worst severity across findings, or null
 * @property {Finding[]} findings        May be empty
 * @property {string} [rawOutput]        Path to raw tool output on disk (optional)
 * @property {number} durationMs         Wall-clock runtime of the check
 * @property {string} [reason]           Required when status is 'skip' or 'error'
 */

export const CHECK_STATUSES = Object.freeze(['pass', 'fail', 'skip', 'error']);
export const SEVERITIES = Object.freeze(['critical', 'serious', 'moderate', 'info']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Validate a CheckResult against the contract.
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCheckResult(obj) {
  const errors = [];

  if (obj == null || typeof obj !== 'object') {
    return { valid: false, errors: ['result must be an object'] };
  }

  if (!isNonEmptyString(obj.checkId)) errors.push('checkId must be a non-empty string');
  if (!isNonEmptyString(obj.tool)) errors.push('tool must be a non-empty string');

  // status: never absent, must be a known value.
  if (!('status' in obj)) {
    errors.push('status is required and must never be absent');
  } else if (!CHECK_STATUSES.includes(obj.status)) {
    errors.push(`status must be one of ${CHECK_STATUSES.join('|')} (got ${JSON.stringify(obj.status)})`);
  }

  // score: a number in [0,100], or explicit null. undefined is invalid —
  // a missing score must be expressed as null, never omitted (0 !== null).
  if (!('score' in obj)) {
    errors.push('score is required: use null when the tool produces no score (null is distinct from 0)');
  } else if (obj.score === null) {
    // valid: no score produced
  } else if (typeof obj.score !== 'number' || Number.isNaN(obj.score)) {
    errors.push('score must be a number or null');
  } else if (obj.score < 0 || obj.score > 100) {
    errors.push('score must be within 0-100');
  }

  // grade: string or null.
  if (!('grade' in obj) || (obj.grade !== null && typeof obj.grade !== 'string')) {
    errors.push('grade must be a string or null');
  }

  // severity: known value or null.
  if (!('severity' in obj) || (obj.severity !== null && !SEVERITIES.includes(obj.severity))) {
    errors.push(`severity must be one of ${SEVERITIES.join('|')} or null`);
  }

  // findings: array of well-formed findings.
  if (!Array.isArray(obj.findings)) {
    errors.push('findings must be an array');
  } else {
    obj.findings.forEach((f, i) => {
      if (f == null || typeof f !== 'object') {
        errors.push(`findings[${i}] must be an object`);
        return;
      }
      if (!SEVERITIES.includes(f.severity)) {
        errors.push(`findings[${i}].severity must be one of ${SEVERITIES.join('|')}`);
      }
      if (!isNonEmptyString(f.message)) {
        errors.push(`findings[${i}].message must be a non-empty string`);
      }
      if ('url' in f && f.url != null && typeof f.url !== 'string') {
        errors.push(`findings[${i}].url must be a string when present`);
      }
      if ('context' in f && f.context != null && typeof f.context !== 'string') {
        errors.push(`findings[${i}].context must be a string when present`);
      }
    });
  }

  if (typeof obj.durationMs !== 'number' || Number.isNaN(obj.durationMs) || obj.durationMs < 0) {
    errors.push('durationMs must be a non-negative number');
  }

  // reason: mandatory whenever the check did not actually run/evaluate.
  if (obj.status === 'skip' || obj.status === 'error') {
    if (!isNonEmptyString(obj.reason)) {
      errors.push(`reason is required when status is '${obj.status}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Throwing wrapper for internal callers that want fail-fast behavior.
 * @param {unknown} obj
 * @returns {CheckResult}
 */
export function assertCheckResult(obj) {
  const { valid, errors } = validateCheckResult(obj);
  if (!valid) {
    throw new TypeError(`Invalid CheckResult: ${errors.join('; ')}`);
  }
  return /** @type {CheckResult} */ (obj);
}

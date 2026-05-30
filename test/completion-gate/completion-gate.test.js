'use strict';

// Regression test for the grp:-plan gate in the completion hook
// (templates/hooks/action-completion-gate.sh, Piece 4 of the execute-plans
// split). The hook fires PreToolUse on pib_complete_action and must block a
// grouped plan's completion unless its workflow Completion Report clears it.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');

const HOOK = path.join(__dirname, '..', '..', 'templates', 'hooks', 'action-completion-gate.sh');

function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-gate-test-'));
  fs.mkdirSync(path.join(dir, '.claude', 'verification'), { recursive: true });
  return dir;
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

function setupDb(tmp, rows) {
  const db = new Database(path.join(tmp, 'pib.db'));
  db.exec('CREATE TABLE actions (fid TEXT, tags TEXT)');
  const ins = db.prepare('INSERT INTO actions VALUES (?,?)');
  for (const [fid, tags] of rows) ins.run(fid, tags);
  db.close();
}
function breadcrumb(tmp, fid, extra = {}) {
  const body = Object.assign({ fid, spec_read: true, ac_verified: true, scenarios_updated: [] }, extra);
  fs.writeFileSync(path.join(tmp, '.claude', 'verification', `${fid}.json`), JSON.stringify(body));
}
function report(tmp, label, { fid, status = 'merged', cp3 = 'continue', validate = 'pass', breadcrumbs = 'valid' }) {
  const r = {
    per_plan: [{ fid, status }],
    checkpoints: { cp3_group: cp3, integration: { validate, breadcrumbs } },
  };
  fs.writeFileSync(path.join(tmp, '.claude', 'verification', `group-${label}-report.json`), JSON.stringify(r));
}
function runGate(tmp, fid) {
  return execFileSync('bash', [HOOK], {
    cwd: tmp,
    env: { ...process.env, CLAUDE_TOOL_INPUT: JSON.stringify({ fid }), PIB_DB_PATH: 'pib.db' },
    encoding: 'utf8',
  });
}
const isBlock = (out) => /"decision"\s*:\s*"block"/.test(out);

test('grp plan: valid breadcrumb + valid report → allow', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1,grp-hash:abc']]);
    breadcrumb(tmp, 'act:g');
    report(tmp, 'demo-1', { fid: 'act:g' });
    assert.strictEqual(isBlock(runGate(tmp, 'act:g')), false);
  } finally { cleanup(tmp); }
});

test('grp plan: missing report → block', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    breadcrumb(tmp, 'act:g');
    const out = runGate(tmp, 'act:g');
    assert.ok(isBlock(out));
    assert.match(out, /execute-group/); // recovery instruction present
  } finally { cleanup(tmp); }
});

test('grp plan: report status=parked → block', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    breadcrumb(tmp, 'act:g');
    report(tmp, 'demo-1', { fid: 'act:g', status: 'parked' });
    assert.ok(isBlock(runGate(tmp, 'act:g')));
  } finally { cleanup(tmp); }
});

test('grp plan: cp3_group=stop → block', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    breadcrumb(tmp, 'act:g');
    report(tmp, 'demo-1', { fid: 'act:g', cp3: 'stop' });
    assert.ok(isBlock(runGate(tmp, 'act:g')));
  } finally { cleanup(tmp); }
});

test('grp plan: integration.validate=fail → block', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    breadcrumb(tmp, 'act:g');
    report(tmp, 'demo-1', { fid: 'act:g', validate: 'fail' });
    assert.ok(isBlock(runGate(tmp, 'act:g')));
  } finally { cleanup(tmp); }
});

test('grp plan: breadcrumb missing scenarios_updated → block', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    // breadcrumb without scenarios_updated
    fs.writeFileSync(
      path.join(tmp, '.claude', 'verification', 'act:g.json'),
      JSON.stringify({ fid: 'act:g', spec_read: true, ac_verified: true })
    );
    report(tmp, 'demo-1', { fid: 'act:g' });
    assert.ok(isBlock(runGate(tmp, 'act:g')));
  } finally { cleanup(tmp); }
});

test('grp plan: missing breadcrumb → block (base gate)', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    report(tmp, 'demo-1', { fid: 'act:g' });
    assert.ok(isBlock(runGate(tmp, 'act:g')));
  } finally { cleanup(tmp); }
});

test('grp-generated:/grp-hash: tags without grp: do NOT trigger the group gate', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp-generated:2026-05-30,grp-hash:abc']]);
    breadcrumb(tmp, 'act:g');
    // No grp: label → treated as a plain plan → base gate passes → allow.
    assert.strictEqual(isBlock(runGate(tmp, 'act:g')), false);
  } finally { cleanup(tmp); }
});

test('path-traversal label is sanitized (no escape, blocks on missing report)', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:../../etc/evil']]);
    breadcrumb(tmp, 'act:g');
    const out = runGate(tmp, 'act:g');
    // Sanitized label can't resolve outside .claude/verification; report
    // absent → block. The point is it does not traverse, not the verdict.
    assert.ok(isBlock(out));
  } finally { cleanup(tmp); }
});

test('malformed report (per_plan not a list) → block, REPORT_UNREADABLE', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:g', 'grp:demo-1']]);
    breadcrumb(tmp, 'act:g');
    fs.writeFileSync(
      path.join(tmp, '.claude', 'verification', 'group-demo-1-report.json'),
      JSON.stringify({ per_plan: null, checkpoints: {} })
    );
    const out = runGate(tmp, 'act:g');
    assert.ok(isBlock(out));
    assert.match(out, /REPORT_UNREADABLE/);
  } finally { cleanup(tmp); }
});

test('plain (non-grp) plan with valid breadcrumb → allow, gate skipped', () => {
  const tmp = makeTmp();
  try {
    setupDb(tmp, [['act:p', '']]);
    breadcrumb(tmp, 'act:p');
    assert.strictEqual(isBlock(runGate(tmp, 'act:p')), false);
  } finally { cleanup(tmp); }
});

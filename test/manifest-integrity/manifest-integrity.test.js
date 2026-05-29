'use strict';

// Manifest-integrity regression guard.
//
// Root cause this prevents: a template authored under templates/ but never
// listed in any MODULES entry never ships — the orphan bug that left the
// entire built-in-memory layer (cc-remember, memory reader, scripts, rule,
// index-guard hook) uninstalled in every project before v0.27.2.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { MODULES } = require('../../lib/cli');
const { DEFAULT_HOOKS } = require('../../lib/settings-merge');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

// Skills that intentionally live under templates/ but must NOT ship to
// consumers (maintainer-only). Keep this list tight and documented.
const SKILL_ORPHAN_ALLOWLIST = new Set(['cc-publish']);

function allTemplatePaths() {
  const paths = [];
  for (const mod of Object.values(MODULES)) {
    for (const t of mod.templates || []) paths.push(t);
  }
  return paths;
}

test('every template path in MODULES exists under templates/ (no dead refs)', () => {
  const missing = [];
  for (const rel of allTemplatePaths()) {
    if (!fs.existsSync(path.join(TEMPLATES_DIR, rel))) missing.push(rel);
  }
  assert.deepStrictEqual(
    missing,
    [],
    `MODULES references template paths that do not exist: ${missing.join(', ')}`
  );
});

test('memory module wires all 6 built-in-memory artifacts', () => {
  const mem = MODULES.memory;
  assert.ok(mem, 'memory module must exist');
  const expected = [
    'skills/cc-remember',
    'skills/memory',
    'rules/memory-capture.md',
    'scripts/write-memory-file.mjs',
    'scripts/validate-memory.mjs',
    'scripts/project-context.cjs',
  ];
  for (const e of expected) {
    assert.ok(
      mem.templates.includes(e),
      `memory module must wire ${e}`
    );
  }
  // lean:true is load-bearing — keeps the unit atomic on lean installs.
  assert.strictEqual(mem.lean, true, 'memory module must be lean:true');
  assert.strictEqual(mem.default, true, 'memory module must be default:true');
});

test('the moved memory scripts require their co-located sibling, not ../lib', () => {
  for (const s of ['write-memory-file.mjs', 'validate-memory.mjs']) {
    const body = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'scripts', s),
      'utf8'
    );
    assert.ok(
      body.includes("require('./project-context.cjs')"),
      `${s} must require the co-located ./project-context.cjs`
    );
    assert.ok(
      !body.includes("require('../lib/project-context')"),
      `${s} must NOT require ../lib/project-context (consumers have no lib/)`
    );
  }
});

test('dead omega hook domain-memories.sh is absent from all manifests', () => {
  for (const rel of allTemplatePaths()) {
    assert.ok(
      !rel.endsWith('domain-memories.sh'),
      `domain-memories.sh must not be in any module manifest (found: ${rel})`
    );
  }
});

test('memory-index-guard.sh is shipped (hooks module) and registered (PostToolUse)', () => {
  assert.ok(
    MODULES.hooks.templates.includes('hooks/memory-index-guard.sh'),
    'hooks module must ship memory-index-guard.sh'
  );
  const registered = (DEFAULT_HOOKS.PostToolUse || []).some((entry) =>
    (entry.hooks || []).some((h) =>
      (h.command || '').endsWith('memory-index-guard.sh')
    )
  );
  assert.ok(
    registered,
    'memory-index-guard.sh must be registered as a PostToolUse hook'
  );
});

test('site-audit module exists, is opt-in (default:false, lean:false), and wires all paths', () => {
  const sa = MODULES['site-audit'];
  assert.ok(sa, 'site-audit module must exist');
  assert.strictEqual(sa.default, false, 'site-audit must be opt-in (default:false)');
  assert.strictEqual(sa.lean, false, 'site-audit must not be lean');
  assert.ok(
    sa.templates.includes('skills/cc-site-audit'),
    'site-audit module must wire skills/cc-site-audit'
  );
  assert.ok(
    sa.templates.includes('site-audit-runtime'),
    'site-audit module must wire site-audit-runtime'
  );
  assert.ok(sa.postInstall, 'site-audit module must have a postInstall handler');
});

test('postInstall dispatch is table-driven (no hardcoded verify-setup branch)', () => {
  const cliSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'cli.js'), 'utf8');
  assert.ok(
    !cliSrc.includes("=== 'verify-setup'"),
    'postInstall dispatch must be table-driven, not if/else on verify-setup'
  );
  assert.ok(
    cliSrc.includes('POST_INSTALL_HANDLERS'),
    'postInstall must use the POST_INSTALL_HANDLERS registry'
  );
});

test('no skill under templates/skills/ is orphaned (except allowlist)', () => {
  const referenced = new Set();
  for (const rel of allTemplatePaths()) {
    const m = rel.match(/^skills\/([^/]+)/);
    if (m) referenced.add(m[1]);
  }
  const skillDirs = fs
    .readdirSync(path.join(TEMPLATES_DIR, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const orphans = skillDirs.filter(
    (name) => !referenced.has(name) && !SKILL_ORPHAN_ALLOWLIST.has(name)
  );
  assert.deepStrictEqual(
    orphans,
    [],
    `Unreferenced skills (orphans) under templates/skills/: ${orphans.join(', ')}. ` +
      `Add to a module manifest, or to SKILL_ORPHAN_ALLOWLIST if maintainer-only.`
  );
});

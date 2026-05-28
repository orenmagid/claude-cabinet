/**
 * Shared project-identity and memory-dir resolution for CC's
 * memory-related tooling. Used by:
 *   - lib/migrate-from-omega.js (Phase 1 migration)
 *   - scripts/write-memory-file.mjs (Phase 3a /cc-remember writer)
 *   - scripts/validate-memory.mjs (Phase 3a validator)
 *
 * Worktree-safe: resolves project identity via `git rev-parse
 * --git-common-dir`, so callers from a worktree write to the host
 * project's memory dir, not a per-worktree split.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

/**
 * Resolve the absolute path of the current project's primary checkout.
 * Worktree-safe via git common-dir; falls back to cwd if not in a repo.
 */
function resolveProjectAbsolutePath(cwd = process.cwd()) {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const abs = path.isAbsolute(commonDir) ? commonDir : path.resolve(cwd, commonDir);
    return path.dirname(abs);
  } catch {
    return path.resolve(cwd);
  }
}

/**
 * Project slug — the basename of the project root. Used as a
 * human-readable identifier and to match memory keys.
 */
function resolveProjectSlug(cwd = process.cwd()) {
  return path.basename(resolveProjectAbsolutePath(cwd));
}

/**
 * Convert an absolute path to Claude Code's project-dir slug format
 * (dashified). `/Users/x/claude-cabinet` → `-Users-x-claude-cabinet`.
 */
function dashifiedSlug(absolutePath) {
  return absolutePath.replace(/^\//, '-').replace(/\//g, '-');
}

/**
 * Read settings.json safely; returns {} on absence or parse error.
 */
function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Resolve the memory directory for the current project.
 * Honors `autoMemoryDirectory` setting if present in ~/.claude/settings.json.
 * Otherwise uses platform default: ~/.claude/projects/<dashified>/memory/.
 *
 * Rejects literal `~` in autoMemoryDirectory — Claude Code does NOT
 * expand tilde in settings.json values, and a silent `./~/...` directory
 * is a footgun.
 */
function resolveMemoryDir(opts = {}) {
  const homeDir = opts.homeDir || os.homedir();
  const cwd = opts.cwd || process.cwd();
  const settingsPath = opts.settingsPath || path.join(homeDir, '.claude', 'settings.json');

  if (opts.memoryDir) return path.resolve(opts.memoryDir);

  const settings = readSettings(settingsPath);
  if (settings.autoMemoryDirectory) {
    const v = settings.autoMemoryDirectory;
    if (v.includes('~')) {
      throw new Error(
        `autoMemoryDirectory in ${settingsPath} contains '~' (literal). Claude Code does not expand tilde. Use an absolute path.`
      );
    }
    return path.resolve(v);
  }

  const projectAbs = resolveProjectAbsolutePath(cwd);
  return path.join(homeDir, '.claude', 'projects', dashifiedSlug(projectAbs), 'memory');
}

module.exports = {
  resolveProjectAbsolutePath,
  resolveProjectSlug,
  resolveMemoryDir,
  dashifiedSlug,
  readSettings,
};

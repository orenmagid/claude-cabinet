/**
 * verify-setup.js — install the cabinet-verify runtime tarball at
 * ~/.claude-cabinet/verify/<version>/dist/.
 *
 * Mirrors the omega-setup.js pattern: dispatched from cli.js's install
 * pipeline when the `verify` module is selected. Idempotent: skips if
 * the matching-version tarball is already present.
 *
 * See templates/verify-runtime/CONVENTIONS.md §Install Dir and
 * §Tarball Install Pattern for the frozen contract this implements.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CC_HOME = path.join(os.homedir(), '.claude-cabinet');
const VERIFY_BASE = path.join(CC_HOME, 'verify');

/**
 * Set up the cabinet-verify runtime.
 *
 * Steps:
 * 1. Read the version from templates/verify-runtime/package.json
 * 2. Compute installDir = ~/.claude-cabinet/verify/<version>/dist/
 * 3. If a tarball already exists at that path with the same version,
 *    log "already installed" and skip
 * 4. Otherwise: mkdir -p installDir; npm pack inside templates/verify-runtime/;
 *    move the .tgz to installDir
 * 5. Write ~/.claude-cabinet/verify/current/VERSION (single-line pointer
 *    used by /verify install.sh per CONVENTIONS.md Version Resolution)
 *
 * @param {Object} opts
 * @param {boolean} [opts.dryRun] — print planned actions, don't execute
 * @param {string} [opts.runtimeSourceDir] — override the templates/verify-runtime/
 *   location. Defaults to <repo>/templates/verify-runtime/ resolved from __dirname.
 * @returns {Object} { installPath, version, status: 'installed'|'skipped'|'dry-run' }
 */
function setupVerifyRuntime(opts = {}) {
  const dryRun = !!opts.dryRun;
  const runtimeSourceDir =
    opts.runtimeSourceDir || path.resolve(__dirname, '..', 'templates', 'verify-runtime');

  // 1. Read version
  const packageJsonPath = path.join(runtimeSourceDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      `verify-setup: ${packageJsonPath} not found. Cannot resolve cabinet-verify version.`,
    );
  }
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = pkg.version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`verify-setup: ${packageJsonPath} has no version field`);
  }

  // 2. Compute installDir
  const installDir = path.join(VERIFY_BASE, version, 'dist');
  const tarballName = `cabinet-verify-${version}.tgz`;
  const tarballPath = path.join(installDir, tarballName);
  const versionPointer = path.join(VERIFY_BASE, 'current', 'VERSION');

  const results = [];

  if (dryRun) {
    results.push(`Would install cabinet-verify@${version}`);
    results.push(`  source:  ${runtimeSourceDir}`);
    results.push(`  target:  ${tarballPath}`);
    results.push(`  pointer: ${versionPointer}`);
    return { installPath: installDir, version, status: 'dry-run', results };
  }

  // 3. Idempotency check
  if (fs.existsSync(tarballPath)) {
    results.push(`cabinet-verify@${version} already installed (${tarballPath})`);
    // Even on skip, ensure the VERSION pointer is up-to-date so a later
    // version downgrade doesn't leave a stale pointer behind.
    writeVersionPointer(versionPointer, version);
    results.push(`Updated VERSION pointer: ${versionPointer}`);
    return { installPath: installDir, version, status: 'skipped', results };
  }

  // 4. mkdir + npm pack + move
  fs.mkdirSync(installDir, { recursive: true });
  // Run npm pack in the runtime source dir. --pack-destination writes
  // the tarball directly to installDir without an intermediate cwd move.
  const packStdout = execSync(`npm pack --silent --pack-destination "${installDir}"`, {
    cwd: runtimeSourceDir,
    encoding: 'utf8',
  }).trim();

  // npm pack prints the tarball filename to stdout on the last non-empty line.
  // Normalise to the expected name so consuming projects can rely on the
  // CONVENTIONS.md-documented path.
  const lastLine = packStdout.split('\n').filter(Boolean).pop() || '';
  const producedName = path.basename(lastLine);
  if (producedName && producedName !== tarballName) {
    // npm pack may produce a name like 'cabinet-verify-0.1.0.tgz' that already
    // matches; if it doesn't (e.g., npm prefixes with @scope/), rename to match.
    const producedPath = path.join(installDir, producedName);
    if (fs.existsSync(producedPath)) {
      fs.renameSync(producedPath, tarballPath);
    }
  }

  if (!fs.existsSync(tarballPath)) {
    throw new Error(
      `verify-setup: npm pack completed but ${tarballPath} not found. ` +
        `stdout was: ${packStdout.slice(0, 500)}`,
    );
  }

  results.push(`Installed cabinet-verify@${version} to ${tarballPath}`);

  // 5. Write VERSION pointer
  writeVersionPointer(versionPointer, version);
  results.push(`Wrote VERSION pointer: ${versionPointer}`);

  return { installPath: installDir, version, status: 'installed', results };
}

function writeVersionPointer(pointerPath, version) {
  fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
  // No trailing newline — CONVENTIONS.md frozen contract requires the
  // file to equal the version string exactly under `cat`.
  fs.writeFileSync(pointerPath, version, 'utf8');
}

module.exports = { setupVerifyRuntime };

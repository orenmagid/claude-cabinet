/**
 * site-audit-setup.js — install the @claude-cabinet/site-audit runtime
 * to ~/.claude-cabinet/site-audit/<version>/.
 *
 * Mirrors verify-setup.js: npm-pack the source, install to a versioned
 * dir, write a current/VERSION pointer. Idempotent.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CC_HOME = path.join(os.homedir(), '.claude-cabinet');
const SITE_AUDIT_BASE = path.join(CC_HOME, 'site-audit');

function setupSiteAuditRuntime(opts = {}) {
  const dryRun = !!opts.dryRun;
  const runtimeSourceDir =
    opts.runtimeSourceDir || path.resolve(__dirname, '..', 'templates', 'site-audit-runtime');

  const packageJsonPath = path.join(runtimeSourceDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`site-audit-setup: ${packageJsonPath} not found.`);
  }
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = pkg.version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`site-audit-setup: ${packageJsonPath} has no version field`);
  }

  const installDir = path.join(SITE_AUDIT_BASE, version, 'dist');
  const tarballName = `claude-cabinet-site-audit-${version}.tgz`;
  const tarballPath = path.join(installDir, tarballName);
  const versionPointer = path.join(SITE_AUDIT_BASE, 'current', 'VERSION');
  const results = [];

  if (dryRun) {
    results.push(`Would install @claude-cabinet/site-audit@${version}`);
    results.push(`  source:  ${runtimeSourceDir}`);
    results.push(`  target:  ${tarballPath}`);
    results.push(`  pointer: ${versionPointer}`);
    return { installPath: installDir, version, status: 'dry-run', results };
  }

  if (fs.existsSync(tarballPath) && fs.statSync(tarballPath).size > 1024) {
    results.push(`@claude-cabinet/site-audit@${version} already installed (${tarballPath})`);
    writeVersionPointer(versionPointer, version);
    return { installPath: installDir, version, status: 'skipped', results };
  }

  if (fs.existsSync(tarballPath)) fs.unlinkSync(tarballPath);

  fs.mkdirSync(installDir, { recursive: true });
  const packStdout = execSync(`npm pack --silent --pack-destination "${installDir}"`, {
    cwd: runtimeSourceDir,
    encoding: 'utf8',
  }).trim();

  const lastLine = packStdout.split('\n').filter(Boolean).pop() || '';
  const producedName = path.basename(lastLine);
  if (producedName && producedName !== tarballName) {
    const producedPath = path.join(installDir, producedName);
    if (fs.existsSync(producedPath)) {
      fs.renameSync(producedPath, tarballPath);
    }
  }

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`site-audit-setup: tarball not found after npm pack: ${tarballPath}`);
  }

  writeVersionPointer(versionPointer, version);
  results.push(`Installed @claude-cabinet/site-audit@${version}`);
  results.push(`  ${tarballPath}`);
  return { installPath: installDir, version, status: 'installed', results };
}

function writeVersionPointer(pointerPath, version) {
  fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
  fs.writeFileSync(pointerPath, version + '\n', 'utf8');
}

module.exports = { setupSiteAuditRuntime };

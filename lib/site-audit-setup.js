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
    // Tarball exists — ensure it's extracted and installed (may have been
    // packed but not installed on a prior run)
    extractAndInstall(path.join(SITE_AUDIT_BASE, version), tarballPath, results);
    updateCurrentBinSymlink(SITE_AUDIT_BASE, version);
    writeVersionPointer(versionPointer, version);
    results.push(`@claude-cabinet/site-audit@${version} already installed (${tarballPath})`);
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

  // Extract and install so the runtime is runnable (not just a tarball)
  extractAndInstall(path.join(SITE_AUDIT_BASE, version), tarballPath, results);

  writeVersionPointer(versionPointer, version);
  updateCurrentBinSymlink(SITE_AUDIT_BASE, version);
  results.push(`Installed @claude-cabinet/site-audit@${version}`);
  results.push(`  ${tarballPath}`);
  return { installPath: installDir, version, status: 'installed', results };
}

function extractAndInstall(versionDir, tarballPath, results) {
  const pkgDir = path.join(versionDir, 'package');
  if (fs.existsSync(path.join(pkgDir, 'node_modules'))) return;

  execSync(`tar xf "${tarballPath}" -C "${versionDir}"`, { encoding: 'utf8' });
  execSync('npm install --omit=dev --ignore-scripts --silent', { cwd: pkgDir, encoding: 'utf8' });

  // Pa11y needs Puppeteer's Chrome; axe-core needs chromedriver.
  // Both were skipped by --ignore-scripts. Install them now.
  // Clear corrupt Puppeteer cache first (folder exists but binary missing).
  try {
    const cacheBase = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
    if (fs.existsSync(cacheBase)) {
      for (const d of fs.readdirSync(cacheBase)) {
        const chromeBin = path.join(cacheBase, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
        const chromeLinux = path.join(cacheBase, d, 'chrome-linux64', 'chrome');
        if (!fs.existsSync(chromeBin) && !fs.existsSync(chromeLinux)) {
          fs.rmSync(path.join(cacheBase, d), { recursive: true, force: true });
          results.push(`  Cleared corrupt Puppeteer cache: ${d}`);
        }
      }
    }
  } catch { /* tolerate */ }
  try {
    execSync('npx puppeteer browsers install chrome', { cwd: pkgDir, encoding: 'utf8', timeout: 120_000 });
    results.push('  Installed Puppeteer Chrome for Pa11y');
  } catch {
    results.push('  ⚠ Puppeteer Chrome install failed — Pa11y will be unavailable');
  }
  try {
    execSync('npx browser-driver-manager install chrome', { cwd: pkgDir, encoding: 'utf8', timeout: 120_000 });
    results.push('  Installed matching Chrome + chromedriver for axe-core');
  } catch {
    results.push('  ⚠ browser-driver-manager install failed — axe-core will be unavailable');
  }

  const binDir = path.join(versionDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const binSrc = path.join(pkgDir, 'bin', 'cc-site-audit');
  const binDst = path.join(binDir, 'cc-site-audit');
  if (fs.existsSync(binSrc)) {
    try { fs.unlinkSync(binDst); } catch { /* may not exist */ }
    fs.symlinkSync(binSrc, binDst);
    fs.chmodSync(binSrc, 0o755);
  }
  results.push(`  Extracted and installed to ${pkgDir}`);
}

function updateCurrentBinSymlink(baseDir, version) {
  const currentDir = path.join(baseDir, 'current');
  fs.mkdirSync(currentDir, { recursive: true });
  const binLink = path.join(currentDir, 'bin');
  const targetBin = path.join(baseDir, version, 'bin');
  try { fs.unlinkSync(binLink); } catch { /* may not exist */ }
  if (fs.existsSync(targetBin)) {
    fs.symlinkSync(targetBin, binLink);
  }
}

function writeVersionPointer(pointerPath, version) {
  fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
  fs.writeFileSync(pointerPath, version + '\n', 'utf8');
}

module.exports = { setupSiteAuditRuntime };

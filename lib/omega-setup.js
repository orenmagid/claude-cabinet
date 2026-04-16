const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const OMEGA_HOME = path.join(os.homedir(), '.claude-cabinet');
const VENV_DIR = path.join(OMEGA_HOME, 'omega-venv');
const VENV_PYTHON = path.join(VENV_DIR, 'bin', 'python3');

// Ordered by preference: 3.13 first (ONNX runtime segfaults on 3.14 during
// shutdown — exit 139, triggers macOS crash dialogs). 3.14 last as fallback.
// Apple Silicon paths, then Intel Mac paths, then PATH fallback.
const PYTHON_CANDIDATES = [
  '/opt/homebrew/opt/python@3.13/bin/python3.13',
  '/opt/homebrew/opt/python@3.12/bin/python3.12',
  '/opt/homebrew/opt/python@3.11/bin/python3.11',
  '/opt/homebrew/opt/python@3.14/bin/python3.14',
  '/usr/local/opt/python@3.13/bin/python3.13',
  '/usr/local/opt/python@3.12/bin/python3.12',
  '/usr/local/opt/python@3.11/bin/python3.11',
  '/usr/local/opt/python@3.14/bin/python3.14',
  '/opt/homebrew/bin/python3',
  '/usr/local/bin/python3',
];

/**
 * Find a Python >= 3.11 on this system.
 * Returns the absolute path or null if none found.
 */
function findPython() {
  for (const candidate of PYTHON_CANDIDATES) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const version = execSync(`"${candidate}" --version 2>&1`, { encoding: 'utf8' }).trim();
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major === 3 && minor >= 11) return candidate;
      }
    } catch { /* skip */ }
  }

  // Last resort: bare python3 on PATH
  try {
    const version = execSync('python3 --version 2>&1', { encoding: 'utf8' }).trim();
    const match = version.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major === 3 && minor >= 11) {
        const which = execSync('which python3', { encoding: 'utf8' }).trim();
        return which;
      }
    }
  } catch { /* skip */ }

  return null;
}

/**
 * Set up the omega-memory venv and download the embedding model.
 *
 * Steps:
 * 1. Find Python 3.11+
 * 2. Create venv at ~/.claude-cabinet/omega-venv/
 * 3. pip install omega-memory
 * 4. Run omega setup --download-model (downloads ONNX model at install time)
 *
 * Returns an array of status messages (like db-setup.js).
 * Throws on failure.
 */
function setupOmega() {
  const results = [];

  // 1. Find Python
  const pythonPath = findPython();
  if (!pythonPath) {
    throw new Error(
      'Python 3.11+ not found. Install via Homebrew: brew install python@3.13\n' +
      '    On Debian/Ubuntu: sudo apt install python3.13 python3.13-venv'
    );
  }
  results.push(`Found Python: ${pythonPath}`);

  // 2. Check ensurepip (Debian/Ubuntu strips it)
  try {
    execSync(`"${pythonPath}" -c "import ensurepip"`, { stdio: 'pipe' });
  } catch {
    const version = execSync(`"${pythonPath}" --version`, { encoding: 'utf8' }).trim();
    const match = version.match(/Python (\d+)\.(\d+)/);
    const pkg = match ? `python${match[1]}.${match[2]}-venv` : 'python3-venv';
    throw new Error(
      `Python venv module not found. On Debian/Ubuntu, install it:\n` +
      `    sudo apt install ${pkg}`
    );
  }

  // 3. Create or verify venv
  if (!fs.existsSync(OMEGA_HOME)) {
    fs.mkdirSync(OMEGA_HOME, { recursive: true });
  }

  if (fs.existsSync(VENV_PYTHON)) {
    // Venv already exists — verify it works
    try {
      execSync(`"${VENV_PYTHON}" -c "import omega"`, { stdio: 'pipe' });
      results.push('Existing omega venv is valid');
      // Ensure cross-encoder model is downloaded (added in v0.9.1)
      try {
        const hasReranker = execSync(
          `"${VENV_PYTHON}" -c "from omega.reranker import _get_model_dir; print('yes' if _get_model_dir() else 'no')"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (hasReranker === 'no') {
          console.log('  Downloading cross-encoder model...');
          execSync(`"${VENV_PYTHON}" -c "from omega.reranker import download_model; download_model()"`, {
            stdio: 'pipe',
            timeout: 120000,
          });
          results.push('Downloaded cross-encoder reranker model');
        }
      } catch { /* non-fatal */ }

      // Ensure MCP server extra is installed (added in v0.21)
      try {
        execSync(`"${VENV_PYTHON}" -c "import mcp"`, { stdio: 'pipe' });
      } catch {
        console.log('  Installing MCP server support...');
        try {
          execSync(`"${VENV_PYTHON}" -m pip install --quiet "omega-memory[server]"`, {
            stdio: 'pipe', timeout: 120000,
          });
          results.push('Installed MCP server support');
        } catch { /* non-fatal */ }
      }

      // Ensure omega MCP server is registered in global settings
      try {
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        let settings = {};
        if (fs.existsSync(settingsPath)) {
          try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { settings = {}; }
        }
        if (!settings.mcpServers) settings.mcpServers = {};
        if (!settings.mcpServers.omega) {
          settings.mcpServers.omega = {
            command: path.join(VENV_DIR, 'bin', 'omega'),
            args: ['serve'],
          };
          fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
          results.push('Registered omega MCP server (global settings)');
        }
      } catch { /* non-fatal */ }

      return results;
    } catch {
      // Venv is broken — nuke and rebuild (D5)
      results.push('Existing venv broken, rebuilding...');
      fs.rmSync(VENV_DIR, { recursive: true, force: true });
    }
  }

  console.log('  Creating Python venv...');
  execSync(`"${pythonPath}" -m venv "${VENV_DIR}"`, { stdio: 'pipe' });
  results.push('Created venv at ~/.claude-cabinet/omega-venv/');

  // 4. Install omega-memory (with MCP server support)
  console.log('  Installing omega-memory...');
  execSync(`"${VENV_PYTHON}" -m pip install --quiet "omega-memory[server]"`, {
    stdio: 'pipe',
    timeout: 120000,
  });
  results.push('Installed omega-memory (with MCP server)');

  // 5. Download embedding model at install time (D4)
  console.log('  Downloading embedding model...');
  execSync(`"${VENV_PYTHON}" -m omega.cli setup --download-model`, {
    stdio: 'pipe',
    timeout: 120000,
    env: { ...process.env, OMEGA_TELEMETRY: '0' },
  });
  results.push('Downloaded ONNX embedding model (bge-small-en-v1.5)');

  // 6. Download cross-encoder reranker model (improves query result ranking)
  console.log('  Downloading cross-encoder model...');
  try {
    execSync(`"${VENV_PYTHON}" -c "from omega.reranker import download_model; download_model()"`, {
      stdio: 'pipe',
      timeout: 120000,
    });
    results.push('Downloaded cross-encoder reranker model');
  } catch {
    // Non-fatal — queries work without it, just less accurate ranking
    results.push('Cross-encoder model download skipped (optional)');
  }

  // 7. Configure omega native hooks in global settings
  //    Omega hooks live in ~/.claude/settings.json (global) — they run for all
  //    projects and handle memory capture/recall natively. This is idempotent:
  //    omega checks if hooks already exist before adding them.
  console.log('  Configuring omega hooks...');
  try {
    execSync(`"${VENV_PYTHON}" -m omega.cli hooks setup`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    results.push('Configured omega native hooks (global settings)');
  } catch {
    // Non-fatal — hooks can be set up manually with `omega hooks setup`
    results.push('Omega hooks setup skipped (run `omega hooks setup` manually)');
  }

  // 8. Register omega MCP server in global settings
  //    This enables omega_store(), omega_query(), etc. as MCP tools
  //    available to Claude Code directly (not just via hooks).
  console.log('  Registering omega MCP server...');
  try {
    // Smoke-test: verify `omega serve` can start (requires mcp package)
    execSync(
      `echo '{}' | "${path.join(VENV_DIR, 'bin', 'omega')}" serve 2>&1 | head -1`,
      { stdio: 'pipe', timeout: 10000 }
    );

    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { settings = {}; }
    }
    if (!settings.mcpServers) settings.mcpServers = {};

    // Only add if not already configured
    if (!settings.mcpServers.omega) {
      settings.mcpServers.omega = {
        command: path.join(VENV_DIR, 'bin', 'omega'),
        args: ['serve'],
      };
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      results.push('Registered omega MCP server (global settings)');
    } else {
      results.push('Omega MCP server already registered');
    }
  } catch {
    // Non-fatal — MCP tools are a convenience, hooks still work
    results.push('Omega MCP server registration skipped (run `omega serve` manually to test)');
  }

  return results;
}

/**
 * Check if omega is already set up and functional.
 */
function isOmegaReady() {
  if (!fs.existsSync(VENV_PYTHON)) return false;
  try {
    execSync(`"${VENV_PYTHON}" -c "import omega"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

module.exports = { setupOmega, isOmegaReady, findPython, VENV_DIR, VENV_PYTHON };

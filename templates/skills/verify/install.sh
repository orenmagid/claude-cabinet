#!/usr/bin/env bash
# cabinet-verify — first-run installer for the consuming project's e2e/ dir.
#
# Idempotent: re-running on an existing e2e/ leaves customized files
# alone and only writes missing scaffolding.
#
# ── Portability note (v0.1.0) ─────────────────────────────────────────
# The generated `e2e/package.json` references the cabinet-verify
# runtime via a file: path under ~/.claude-cabinet/verify/<version>/.
# This works for the original developer and on any machine that has
# run `npx create-claude-cabinet --modules verify` to install the
# matching version.
#
# It does NOT work out of the box on:
#   - CI runners (without a setup step that runs the CC installer)
#   - Teammates' machines until they run the CC installer
#
# v0.2.0 intends to publish cabinet-verify to npm and switch the
# reference to a version range (`"cabinet-verify": "^0.x.y"`).
# Until then, the second-developer path requires running the CC
# installer once.
#
# Usage:
#   bash install.sh             # write files
#   bash install.sh --dry-run   # print planned actions, write nothing
#
# Resolves the cabinet-verify runtime version via (in order):
#   1. .ccrc.json modules.verify.version (project-pinned by CC installer)
#   2. ~/.claude-cabinet/verify/current/VERSION (machine-global pointer)
#
# Aborts if neither source is available. See
# templates/verify-runtime/CONVENTIONS.md §Version Resolution.

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

log() {
  echo "  $*" >&2
}

plan_write() {
  # plan_write <relative_path> <content>
  local path="$1"
  if [[ -e "$path" ]]; then
    log "skip  $path (already exists)"
    return 0
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    log "would write  $path"
  else
    mkdir -p "$(dirname "$path")"
    printf '%s' "$2" > "$path"
    log "wrote  $path"
  fi
}

plan_mkdir() {
  local path="$1"
  if [[ -d "$path" ]]; then
    log "skip  $path/ (already exists)"
    return 0
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    log "would mkdir  $path/"
  else
    mkdir -p "$path"
    log "mkdir  $path/"
  fi
}

# ──────────────────────────────────────────────────────────────────────
# Resolve runtime version
# ──────────────────────────────────────────────────────────────────────

VERSION=""

# Step 1: .ccrc.json lookup
if [[ -f .ccrc.json ]]; then
  VERSION=$(node -e "
    try {
      const c = JSON.parse(require('fs').readFileSync('.ccrc.json','utf8'));
      const v = c?.modules?.verify?.version;
      if (typeof v === 'string' && v.length > 0) process.stdout.write(v);
    } catch (e) { /* tolerate */ }
  " 2>/dev/null || echo "")
fi

# Step 2: ~/.claude-cabinet/verify/current/VERSION fallback
if [[ -z "$VERSION" ]]; then
  if [[ -f "$HOME/.claude-cabinet/verify/current/VERSION" ]]; then
    VERSION=$(cat "$HOME/.claude-cabinet/verify/current/VERSION")
  fi
fi

# Step 3: error if neither
if [[ -z "$VERSION" ]]; then
  log "ERROR: cannot resolve cabinet-verify version."
  log "       Run \`npx create-claude-cabinet --modules verify\` first."
  exit 2
fi

TARBALL="$HOME/.claude-cabinet/verify/$VERSION/dist/cabinet-verify-$VERSION.tgz"
if [[ ! -f "$TARBALL" ]]; then
  log "ERROR: cabinet-verify@$VERSION tarball not found at $TARBALL"
  log "       Run \`npx create-claude-cabinet --modules verify\` to install it."
  exit 2
fi

log "cabinet-verify version: $VERSION"
log "tarball: $TARBALL"
log ""

# ──────────────────────────────────────────────────────────────────────
# Scaffold e2e/
# ──────────────────────────────────────────────────────────────────────

plan_mkdir "e2e"
plan_mkdir "e2e/features"
plan_mkdir "e2e/steps"
plan_mkdir "e2e/support"
plan_mkdir "e2e/fixtures"
plan_mkdir "e2e/reports"
plan_mkdir "e2e/screenshots"

# package.json — per CONVENTIONS.md §npm Scripts (frozen contract).
#
# Node-version note: `--env-file-if-exists` requires Node 20.12+. We
# invoke `node` directly (not `NODE_OPTIONS`) because Node 22+ rejects
# `NODE_OPTIONS='--env-file=...'` ("--env-file= is not allowed in
# NODE_OPTIONS"). The CLI form is the only path that works across
# Node 20.12 / 21 / 22+.
#
# Cucumber bin path: cucumber-js v11 ships at
# node_modules/@cucumber/cucumber/bin/cucumber.js. The `cucumber-js`
# shell wrapper does NOT pass through CLI flags like --import in a
# way Node honors after the shebang resolves, so we invoke the .js
# entry directly.
#
PREFLIGHT_CMD="node --env-file-if-exists=.env.local node_modules/cabinet-verify/dist/src/cli/preflight.js"
CUCUMBER_CMD="node --env-file-if-exists=.env.local --import tsx/esm node_modules/@cucumber/cucumber/bin/cucumber.js --import 'steps/**/*.ts' --import 'support/**/*.ts'"

PACKAGE_JSON=$(cat <<JSON
{
  "name": "$(basename "$PWD")-e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Walkthrough verification harness (cabinet-verify).",
  "engines": {
    "node": ">=20.12"
  },
  "scripts": {
    "preflight": "${PREFLIGHT_CMD}",
    "verify": "npm run preflight && ${CUCUMBER_CMD} --tags '@free and not @manual'",
    "verify:cheap": "npm run preflight && ${CUCUMBER_CMD} --tags '(@free or @api-small) and not @manual'",
    "verify:full": "npm run preflight && ${CUCUMBER_CMD} --tags 'not @manual'",
    "verify:manual": "npm run preflight && ${CUCUMBER_CMD} --tags '@manual'",
    "verify:scenario": "npm run preflight && ${CUCUMBER_CMD}",
    "report:last": "cabinet-verify-report-last",
    "report:status": "cabinet-verify-report-status",
    "install:browsers": "playwright install chromium"
  },
  "dependencies": {
    "cabinet-verify": "file:$TARBALL",
    "tsx": "^4.20.0"
  }
}
JSON
)
plan_write "e2e/package.json" "$PACKAGE_JSON"

TSCONFIG_JSON=$(cat <<JSON
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["steps/**/*", "support/**/*"]
}
JSON
)
plan_write "e2e/tsconfig.json" "$TSCONFIG_JSON"

CUCUMBER_JS=$(cat <<'JS'
// cabinet-verify scaffold. Reads scenarios from features/ and step
// definitions from steps/ + support/. The cabinet-verify package
// supplies the World base class and lifecycle hooks via support/world.ts.
//
// Note: cucumber-js v11 ignores the `import:` config key when
// invoked via CLI. Step/support import paths are passed as
// `--import 'steps/**/*.ts' --import 'support/**/*.ts'` in the npm
// scripts in package.json — that is the source of truth, not this file.
export default {
  default: {
    paths: ['features/**/*.feature'],
    format: ['progress-bar'],
    formatOptions: { colorsEnabled: true },
  },
};
JS
)
plan_write "e2e/cucumber.js" "$CUCUMBER_JS"

ENV_LOCAL_EXAMPLE=$(cat <<'ENV'
# Copy to .env.local and fill in. .env.local is gitignored.

# Required: where Playwright drives the dev stack.
CABINET_VERIFY_DEV_URL=http://localhost:5173

# Test user credentials (per role). Add only the roles your scenarios use.
CABINET_VERIFY_USER_EMAIL=
CABINET_VERIFY_USER_PASSWORD=

# CABINET_VERIFY_ADMIN_EMAIL=
# CABINET_VERIFY_ADMIN_PASSWORD=

# CABINET_VERIFY_FRESH_EMAIL=
# CABINET_VERIFY_FRESH_PASSWORD=

# Optional knobs (defaults in parens):
# HEADLESS=1                              # Hide browser window (default headed)
# SLOW_MO=250                             # ms delay per Playwright action (default 0)
# CABINET_VERIFY_SKIP_FRESH_PASSES=1      # Auto-skip P/N items on re-run (default off)
# CABINET_VERIFY_AUTO_SKIP_HUMAN=1        # Smoke-only: auto-skip every human pause
# CABINET_VERIFY_AUTO_OPEN_SCREENSHOTS=1  # Legacy: auto-open each screenshot
# CABINET_VERIFY_FORWARD_CONSOLE=0        # Disable browser console.error forwarding
ENV
)
plan_write "e2e/.env.local.example" "$ENV_LOCAL_EXAMPLE"

WORLD_TS=$(cat <<'TS'
// Project-side World — subclass CabinetVerifyWorld and add any
// scenario-specific state your steps need. The cabinet-verify base
// supplies `context`, `page`, `role`, and `baseUrl` plus lifecycle
// hooks (BeforeAll/AfterAll/Before/After).
import { setWorldConstructor } from '@cucumber/cucumber';
import { CabinetVerifyWorld } from 'cabinet-verify';

export class ProjectWorld extends CabinetVerifyWorld {
  // Add project-specific scenario state here as your scenarios need it.
  // Example:
  //   currentArticleText: string = '';
  //   currentDownload: { name: string; path: string } | null = null;
}

setWorldConstructor(ProjectWorld);
TS
)
plan_write "e2e/support/world.ts" "$WORLD_TS"

AUTH_TS=$(cat <<'TS'
// Project-side sign-in handler. The cabinet-verify baseline step
// "I am signed in as the {role} role" handles the no-auth case
// itself: when CABINET_VERIFY_<ROLE>_EMAIL and _PASSWORD are both
// blank, the harness navigates to "/" and continues. This file is
// only consulted when credentials ARE set, i.e. when you actually
// have an auth flow to drive. Wire it up by calling
// setSignInHandler(signInAs) at module load (the call at the bottom
// is the registration).
import { setSignInHandler, type CabinetVerifyWorld } from 'cabinet-verify';

export async function signInAs(world: CabinetVerifyWorld, role: string): Promise<void> {
  const emailEnv = `CABINET_VERIFY_${role.toUpperCase()}_EMAIL`;
  const passwordEnv = `CABINET_VERIFY_${role.toUpperCase()}_PASSWORD`;
  const email = process.env[emailEnv]!;
  const password = process.env[passwordEnv]!;

  // TODO: replace this stub with the project sign-in flow.
  // Typical shapes:
  //   await world.page.goto(world.baseUrl + '/signin');
  //   await world.page.getByLabel('Email').fill(email);
  //   await world.page.getByLabel('Password').fill(password);
  //   await world.page.getByRole('button', { name: 'Sign in' }).click();
  //   await world.page.waitForURL(world.baseUrl + '/app');
  void email;
  void password;
  throw new Error(
    `signInAs: not implemented. Fill in support/auth.ts with the project sign-in flow.`,
  );
}

setSignInHandler(signInAs);
TS
)
plan_write "e2e/support/auth.ts" "$AUTH_TS"

SELECTORS_TS=$(cat <<'TS'
// Centralized selectors. As your scenarios fail on fragile inline
// selectors, hoist them here. One file to update when the DOM shifts.
//
// Example:
//   export const SIGN_IN_BUTTON = (page: Page) =>
//     page.getByRole('button', { name: 'Sign in' });

export {};
TS
)
plan_write "e2e/support/selectors.ts" "$SELECTORS_TS"

PREFLIGHT_TS=$(cat <<'TS'
// Project-side preflight. Wraps the cabinet-verify generic preflight
// with project-specific checks (fixture files, role credentials, etc).
//
// Invoked via the `preflight` npm script. Exits non-zero on any check
// failure so `npm run verify` aborts before launching Cucumber.
import { preflight } from 'cabinet-verify';

async function main(): Promise<void> {
  const devUrl = process.env.CABINET_VERIFY_DEV_URL || 'http://localhost:5173';
  await preflight({ devStackUrl: devUrl, healthEndpoint: undefined });

  // TODO: add project-specific preflight checks here. Common shapes:
  //   - assert that .env.local exists
  //   - assert that fixtures/ has the expected files
  //   - assert that test user credentials are set
}

main().catch((err) => {
  process.stderr.write(`  ✗ preflight failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
TS
)
plan_write "e2e/support/preflight.ts" "$PREFLIGHT_TS"

# ──────────────────────────────────────────────────────────────────────
# Optional: isolated test-stack scaffold (gated on CABINET_VERIFY_TEST_STACK=1)
#
# When the calibrate phase determines that the project's dev stack
# writes to a real DB whose contents matter, the /verify learn skill
# sets these env vars before invoking install.sh. They populate a
# start-test-stack.sh template the user adapts to the project's boot
# commands. Skipped entirely when the project answered "no" to the
# real-DB question — those projects drive the dev stack directly.
#
# Inputs (env vars set by /verify learn skill when enabled):
#   CABINET_VERIFY_TEST_STACK         "1" to enable
#   CABINET_VERIFY_TEST_DB_FILE       Path to real DB file (or empty for non-file DBs)
#   CABINET_VERIFY_TEST_PROXY_CONFIG  e.g. "vite.config.ts" (or empty)
#   CABINET_VERIFY_TEST_API_PORT      e.g. "3457"
#   CABINET_VERIFY_TEST_DEV_PORT      e.g. "5176"
# ──────────────────────────────────────────────────────────────────────

if [[ "${CABINET_VERIFY_TEST_STACK:-}" == "1" ]]; then
  TS_DB_FILE="${CABINET_VERIFY_TEST_DB_FILE:-}"
  TS_PROXY_CFG="${CABINET_VERIFY_TEST_PROXY_CONFIG:-}"
  TS_API_PORT="${CABINET_VERIFY_TEST_API_PORT:-3457}"
  TS_DEV_PORT="${CABINET_VERIFY_TEST_DEV_PORT:-5176}"
  TS_DB_BASE=""
  if [[ -n "$TS_DB_FILE" ]]; then
    TS_DB_BASE=$(basename "$TS_DB_FILE")
  fi

  START_TEST_STACK=$(cat <<TSH
#!/usr/bin/env bash
# Boot the isolated test stack: a separate API server + dev server
# pointing at a copy of the real DB. Generated by /verify learn when
# the calibrate phase flagged that the dev stack writes to
# a real DB.
#
# Usage:
#   bash e2e/start-test-stack.sh             # foreground (Ctrl-C to stop)
#   bash e2e/start-test-stack.sh --bg        # background (writes PIDs to .e2e-pids)
#   bash e2e/start-test-stack.sh --stop      # stop a backgrounded stack
#
# Ports:
#   API server: ${TS_API_PORT}
#   Dev server: ${TS_DEV_PORT}
#
# The Playwright preflight expects CABINET_VERIFY_DEV_URL to be set to
# http://localhost:${TS_DEV_PORT} in e2e/.env.local for the test stack
# (override your existing CABINET_VERIFY_DEV_URL).

set -euo pipefail

REAL_DB="${TS_DB_FILE}"
TEST_DB="e2e/fixtures/${TS_DB_BASE:-test.db}"

# 1. Snapshot the real DB into the e2e fixtures dir so the test stack
#    never touches the real one.
if [[ -n "\$REAL_DB" && -f "\$REAL_DB" ]]; then
  mkdir -p "\$(dirname "\$TEST_DB")"
  cp "\$REAL_DB" "\$TEST_DB"
fi

# 2. Boot the API server pointing at the test DB on the test API port.
#    TODO: replace with the boot command for this project. Common shapes:
#      DB_PATH="\$TEST_DB" PORT=${TS_API_PORT} node server.js &
#      DATABASE_URL="postgres://.../test" PORT=${TS_API_PORT} npm run start:api &
echo "TODO: implement API server boot in start-test-stack.sh (port ${TS_API_PORT})"
exit 1
TSH
)
  plan_write "e2e/start-test-stack.sh" "$START_TEST_STACK"
  if [[ -f "e2e/start-test-stack.sh" ]]; then
    chmod +x e2e/start-test-stack.sh 2>/dev/null || true
  fi

  README_MD=$(cat <<RDM
# e2e/ — Walkthrough verification harness

Cucumber + Playwright scenarios driven via cabinet-verify.

## Running the isolated test stack

This dev stack writes to a real DB (calibrated during
\`/verify learn\`). To keep test runs from polluting that DB, the
harness expects an isolated test stack on:

- API: http://localhost:${TS_API_PORT}
- Dev: http://localhost:${TS_DEV_PORT}

\`\`\`bash
bash e2e/start-test-stack.sh             # foreground
bash e2e/start-test-stack.sh --bg        # background
\`\`\`

\`e2e/start-test-stack.sh\` was generated as a template — the API
boot command lives behind a \`TODO\` marker. Adapt it to your stack
(node, uvicorn, npm script, etc.), then point \`CABINET_VERIFY_DEV_URL\`
at http://localhost:${TS_DEV_PORT} in \`.env.local\` and run
\`npm run verify\`.

## Where state lives

- \`e2e/fixtures/\` — copies of real data the test stack reads. Safe
  to wipe; regenerated on next \`start-test-stack.sh\`.
- \`e2e/reports/\` — verdict ledger output.
- \`e2e/screenshots/\` — failure screenshots.

## More

See \`.claude/skills/verify/SKILL.md\` for the full /verify workflow.
RDM
)
  plan_write "e2e/README.md" "$README_MD"
fi

# .gitignore updates at project root.
GITIGNORE_ROOT=".gitignore"
GITIGNORE_ENTRIES=("e2e/reports/" "e2e/screenshots/" "e2e/fixtures/articles/" "e2e/.env.local" "e2e/node_modules/" "e2e/.last-verify-run")

if [[ $DRY_RUN -eq 1 ]]; then
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    log "would ensure  .gitignore contains '$entry'"
  done
else
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if [[ -f "$GITIGNORE_ROOT" ]] && grep -qxF "$entry" "$GITIGNORE_ROOT"; then
      log "skip  .gitignore '$entry' (already present)"
    else
      echo "$entry" >> "$GITIGNORE_ROOT"
      log "added .gitignore '$entry'"
    fi
  done
fi

log ""
if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run — no files written. Re-run without --dry-run to scaffold."
else
  log "Scaffolded e2e/. Next steps:"
  log "  cd e2e"
  log "  npm install"
  log "  npm run install:browsers"
  log "  cp .env.local.example .env.local   # then edit with credentials"
  log "  npm run verify                     # smoke run (no scenarios yet)"
  log ""
  log "Then run /verify learn to draft scenarios."
fi

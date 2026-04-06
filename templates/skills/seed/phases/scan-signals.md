# Scan Signals — Where to Look for Technology Adoption

Define what files and patterns to scan for technology signals, and what
expertise each signal implies. The /seed skill reads this file first to
build a picture of the project's technology landscape.

When this file is absent or empty, the default behavior is: scan standard
locations using the default signal-to-expertise mappings below. To
explicitly skip signal scanning, write only `skip: true`.

## What to Include

For each signal source, provide:
- **Where** — the file or glob pattern to check
- **What** — what to extract (dependency names, config keys, file presence)
- **Maps to** — what expertise the signal implies

## Default Signal Sources

### Package Manifests
- `package.json` — `dependencies` and `devDependencies` keys
- `requirements.txt` / `pyproject.toml` — Python dependencies
- `Cargo.toml` — Rust dependencies
- `go.mod` — Go modules
- `Gemfile` — Ruby dependencies

### Configuration Files
- `.eslintrc*`, `eslint.config.*` — linting configuration
- `tailwind.config.*` — utility CSS framework
- `tsconfig.json` — TypeScript
- `docker-compose.yml` — container orchestration
- `.prettierrc*` — code formatting
- `webpack.config.*`, `vite.config.*` — build tooling
- `jest.config.*`, `vitest.config.*` — test configuration

### Infrastructure
- `Dockerfile` — containerization
- `.github/workflows/` — CI/CD via GitHub Actions
- `railway.json` / `railway.toml` — Railway deployment
- `vercel.json` — Vercel deployment
- `fly.toml` — Fly.io deployment
- `netlify.toml` — Netlify deployment

### Database
- `*.db` files — SQLite databases
- `migrations/` directory — schema migration system
- `prisma/` directory — Prisma ORM
- `drizzle.config.*` — Drizzle ORM
- `knexfile.*` — Knex query builder

## Default Signal-to-Expertise Mappings

| Signal | Suggested Cabinet Member |
|--------|----------------------|
| React / Vue / Svelte in deps | usability, accessibility, small-screen |
| UI framework (Mantine, MUI, Chakra, etc.) | usability, framework-quality (project-specific) |
| SQLite / PostgreSQL / MySQL | data-integrity |
| Docker / Railway / Fly.io / Vercel | architecture, security |
| Express / Fastify / Hono | security, speed-freak |
| Test framework (jest, vitest, mocha) | qa |
| TypeScript | boundary-man |
| CI/CD configs (.github/workflows, etc.) | workflow-cop |
| Complex architecture (3+ services, monorepo) | architecture |
| Long-running project (6+ months of git history) | historian |
| Many skills (5+ in .claude/skills/) | roster-check |
| Features shipping regularly | system-advocate |

These mappings are starting points, not prescriptions. A project may
already cover a signal through an existing broader cabinet member (e.g.,
a "code-quality" cabinet member that subsumes boundary-man). The
evaluate-existing phase handles that deduplication.

## Overriding This Phase

Projects override this file to add domain-specific signals. Examples:

- A healthcare project adds: HIPAA-related libraries map to a
  compliance cabinet member
- A financial project adds: payment processing libraries (Stripe,
  Square) map to a financial-integrity cabinet member
- A data pipeline project adds: ETL tools (dbt, Airflow) map to a
  data-quality cabinet member

Keep the default mappings and add project-specific ones below them.
The more signals the scan detects, the better the gap analysis in the
evaluate-existing phase.

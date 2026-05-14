#!/usr/bin/env node
/**
 * CLI bin: cabinet-verify-preflight.
 *
 * Thin wrapper around runPreflightCli() from ../preflight.ts.
 * Consuming projects that need extra preflight checks (fixture files,
 * env-var completeness, platform detection) wrap this in their own
 * project-side preflight script.
 */

import { runPreflightCli } from '../preflight.js';

const code = await runPreflightCli(process.argv.slice(2));
process.exit(code);

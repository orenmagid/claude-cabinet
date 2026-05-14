import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * NOTE (v0.1.0): The size categories below (`short`/`medium`/`long`/
 * `very-long`) and the RECOMMENDED_REWRITE_TIMEOUT_SEC values are tuned
 * for de[sic]ify's article-rewrite workload. They ship as reasonable
 * defaults but are NOT the right abstraction for arbitrary projects.
 *
 * Phase 2 of the cabinet-verify extraction generalizes this: the type
 * becomes `FixtureSize extends string`, the fixture-path map and
 * timeout map become consumer-supplied registries, and these constants
 * move into a default registry that projects opt into or replace.
 *
 * For Phase 1, consuming projects with different fixture shapes should
 * either (a) not import loadFixture (it's optional surface), or
 * (b) ignore the size→timeout map and call recommendedRewriteTimeoutSec
 * with their own constant.
 */
export type FixtureSize = 'short' | 'medium' | 'long' | 'very-long';

const FIXTURE_PATH: Record<FixtureSize, string> = {
  short: 'fixtures/articles/short.txt',
  medium: 'fixtures/articles/medium.txt',
  long: 'fixtures/articles/long.txt',
  'very-long': 'fixtures/articles/very-long.txt',
};

/**
 * Maximum wall-clock seconds to wait for a rewrite to complete on this
 * fixture size. Calibrated against real-user observations:
 *   - short:     30-66s observed → 180s ceiling
 *   - medium:    2-3 min typical → 600s ceiling
 *   - long:      5-15 min typical → 1200s ceiling
 *   - very-long: up to 20 min observed → 1800s ceiling (with buffer)
 *
 * These are CEILINGS for the harness's `waitFor` timeout, not
 * predictions. Keep generous — the cost of waiting too long is one
 * failed run; the cost of timing out mid-stream is a wasted Anthropic
 * call AND a confusing failure surface.
 */
const RECOMMENDED_REWRITE_TIMEOUT_SEC: Record<FixtureSize, number> = {
  short: 180,
  medium: 600,
  long: 1200,
  'very-long': 1800,
};

export interface Fixture {
  size: FixtureSize;
  path: string;
  content: string;
  wordCount: number;
  /** Recommended `waitFor` timeout for the rewrite-completion step
   *  when this fixture is the input. */
  recommendedRewriteTimeoutSec: number;
}

export function recommendedRewriteTimeoutSec(size: FixtureSize): number {
  return RECOMMENDED_REWRITE_TIMEOUT_SEC[size];
}

export async function loadFixture(size: FixtureSize): Promise<Fixture> {
  const rel = FIXTURE_PATH[size];
  const abs = path.resolve(process.cwd(), rel);
  let content: string;
  try {
    content = await fs.readFile(abs, 'utf8');
  } catch (err) {
    throw new Error(
      `Fixture "${size}" not found at ${abs}. ` +
        `See e2e/README.md for source paths to regenerate.`
    );
  }
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    size,
    path: abs,
    content,
    wordCount,
    recommendedRewriteTimeoutSec: RECOMMENDED_REWRITE_TIMEOUT_SEC[size],
  };
}

export function fixtureAbsolutePath(size: FixtureSize): string {
  return path.resolve(process.cwd(), FIXTURE_PATH[size]);
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLaunchOptions, isDemoMode } from '../src/launch-options.js';
import { narrateStep } from '../src/output.js';
import { pauseOnFailure } from '../src/pause-on-failure.js';

describe('isDemoMode', () => {
  it('returns true when CABINET_VERIFY_DEMO=1', () => {
    assert.equal(isDemoMode({ CABINET_VERIFY_DEMO: '1' }), true);
  });

  it('returns false when CABINET_VERIFY_PAUSE_ON_FAIL=1 alone', () => {
    assert.equal(isDemoMode({ CABINET_VERIFY_PAUSE_ON_FAIL: '1' }), false);
  });

  it('returns false for empty env', () => {
    assert.equal(isDemoMode({}), false);
  });
});

describe('resolveLaunchOptions', () => {
  it('DEMO=1 defaults slowMo to 1000 when SLOW_MO unset', () => {
    const opts = resolveLaunchOptions({ CABINET_VERIFY_DEMO: '1' });
    assert.equal(opts.slowMo, 1000);
    assert.equal(opts.headless, false);
  });

  it('DEMO=1 respects explicit SLOW_MO=250', () => {
    const opts = resolveLaunchOptions({ CABINET_VERIFY_DEMO: '1', SLOW_MO: '250' });
    assert.equal(opts.slowMo, 250);
  });

  it('empty env returns slowMo 0', () => {
    const opts = resolveLaunchOptions({});
    assert.equal(opts.slowMo, 0);
    assert.equal(opts.headless, false);
  });

  it('HEADLESS=1 without DEMO returns headless true', () => {
    const opts = resolveLaunchOptions({ HEADLESS: '1' });
    assert.equal(opts.headless, true);
    assert.equal(opts.slowMo, 0);
  });

  it('DEMO=1 forces headless false even if HEADLESS=1', () => {
    const opts = resolveLaunchOptions({ CABINET_VERIFY_DEMO: '1', HEADLESS: '1' });
    assert.equal(opts.headless, false);
  });
});

describe('narrateStep', () => {
  it('strips checkId prefix from check step', () => {
    const result = narrateStep('check "1.04 heading-visible" the workspace heading is visible');
    assert.equal(result, 'the workspace heading is visible');
  });

  it('returns navigation steps unchanged', () => {
    const result = narrateStep('I navigate to "/app"');
    assert.equal(result, 'I navigate to "/app"');
  });

  it('handles empty string', () => {
    const result = narrateStep('');
    assert.equal(result, '');
  });
});

describe('pauseOnFailure', () => {
  it('resolves immediately when result is not FAILED', async () => {
    await pauseOnFailure(undefined, { status: 'PASSED' }, {}, false);
  });

  it('resolves immediately when demo flags are off', async () => {
    await pauseOnFailure(undefined, { status: 'FAILED' }, {}, false);
  });

  it('resolves immediately in non-TTY mode even with demo flags', async () => {
    await pauseOnFailure(
      undefined,
      { status: 'FAILED', message: 'test failure' },
      { CABINET_VERIFY_DEMO: '1' },
      false,
    );
  });
});

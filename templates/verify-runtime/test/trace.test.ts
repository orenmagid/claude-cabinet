import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { traceEnabled, traceFilePath } from '../src/trace.js';

describe('traceEnabled', () => {
  it('true when CABINET_VERIFY_TRACE=1', () => {
    assert.equal(traceEnabled({ CABINET_VERIFY_TRACE: '1' }), true);
  });

  it('true when demo mode is on', () => {
    assert.equal(traceEnabled({ CABINET_VERIFY_DEMO: '1' }), true);
  });

  it('false for empty env', () => {
    assert.equal(traceEnabled({}), false);
  });
});

describe('traceFilePath', () => {
  it('builds a sanitized, timestamped path under traces/', () => {
    assert.equal(
      traceFilePath('Desktop end-to-end rewrite', 1700000000000),
      'traces/Desktop_end-to-end_rewrite-1700000000000.zip',
    );
  });

  it('truncates long scenario names to 60 chars', () => {
    const longName = 'a'.repeat(100);
    const result = traceFilePath(longName, 1);
    const slug = result.replace('traces/', '').replace('-1.zip', '');
    assert.equal(slug.length, 60);
  });

  it('strips unsafe characters', () => {
    assert.equal(
      traceFilePath('foo/bar:baz?qux', 42),
      'traces/foo_bar_baz_qux-42.zip',
    );
  });
});

#!/usr/bin/env node

const { run } = require('../lib/cli');

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

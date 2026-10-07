const { spawnSync } = require('node:child_process')

const result = spawnSync(
  process.execPath,
  [require.resolve('@playwright/test/cli'), 'test', '--grep', 'customer|staff|cashier|order'],
  { stdio: 'inherit' },
)
process.exitCode = result.status ?? 1

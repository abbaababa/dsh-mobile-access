#!/usr/bin/env node
/** Run every test file with an explicit list so Windows needs no shell glob. */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tests = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join('tests', name))

if (tests.length === 0) {
  process.stderr.write('[test] no tests found\n')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' })
process.exit(result.status ?? 1)

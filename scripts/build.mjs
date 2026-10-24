#!/usr/bin/env node
/**
 * Reproducible build for the independent bundle.
 *
 * The host half is ordinary ESM. The browser half is two global scripts
 * concatenated in order; dictionaries and CSS live in assets and are injected
 * as literals after compilation, so no bundler or runtime dependency is needed.
 */

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const buildDir = join(root, 'build')
const tscCandidates = [
  process.env.DSH_TSC,
  join(root, 'node_modules', '.bin', 'tsc'),
  'tsc',
].filter((candidate) => candidate !== undefined)
const tsc = tscCandidates.find((candidate) => candidate === 'tsc' || existsSync(candidate))

function fail(message) {
  process.stderr.write(`[build] ${message}\n`)
  process.exit(1)
}

if (tsc === undefined) fail('TypeScript compiler not found; set DSH_TSC to a tsc executable.')

function runTsc(args) {
  const result = spawnSync(tsc, args, { cwd: root, encoding: 'utf8' })
  if (result.error !== undefined) fail(`cannot run tsc: ${result.error.message}`)
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    fail(`tsc failed with exit code ${result.status ?? 'unknown'}`)
  }
}

runTsc(['-p', 'tsconfig.host.json', ...(checkOnly ? ['--noEmit'] : [])])
runTsc(['-p', 'tsconfig.client.json', ...(checkOnly ? ['--noEmit'] : [])])

if (checkOnly) {
  process.stdout.write('[build] typecheck PASS\n')
  process.exit(0)
}

rmSync(buildDir, { recursive: true, force: true })
mkdirSync(join(buildDir, 'host'), { recursive: true })
mkdirSync(join(buildDir, 'client-parts'), { recursive: true })
runTsc(['-p', 'tsconfig.host.json'])
runTsc(['-p', 'tsconfig.client.json'])

const read = (path) => readFileSync(path, 'utf8')
const zh = JSON.parse(read(join(root, 'locale', 'zh.json')))
const en = JSON.parse(read(join(root, 'locale', 'en.json')))
if (typeof zh.ui !== 'object' || zh.ui === null || typeof en.ui !== 'object' || en.ui === null) {
  fail('locale files must contain a "ui" dictionary')
}
const css = read(join(root, 'src', 'panel.css')).trim()

const runtime = read(join(buildDir, 'client-parts', 'client-runtime.js'))
const panel = read(join(buildDir, 'client-parts', 'client.js'))
let client = `${runtime}\n${panel}`
if (!client.includes('__DICT_ZH__') || !client.includes('__DICT_EN__') || !client.includes('__PANEL_CSS__')) {
  fail('client placeholder missing; did the template change?')
}
client = client
  .replace('__DICT_ZH__', JSON.stringify(zh.ui))
  .replace('__DICT_EN__', JSON.stringify(en.ui))
  .replace('__PANEL_CSS__', JSON.stringify(css))
if (/__DICT_(ZH|EN)__|__PANEL_CSS__/.test(client)) fail('client placeholder replacement incomplete')
writeFileSync(join(root, 'client.js'), `${client.trim()}\n`, 'utf8')

for (const file of readdirSync(join(buildDir, 'host'))) {
  if (!file.endsWith('.js')) continue
  copyFileSync(join(buildDir, 'host', file), join(root, file))
}

const required = ['index.js', 'service.js', 'routes.js', 'html.js', 'types.js', 'client.js']
for (const file of required) {
  if (!existsSync(join(root, file))) fail(`missing build output: ${file}`)
}
process.stdout.write(`[build] OK (${required.join(', ')})\n`)

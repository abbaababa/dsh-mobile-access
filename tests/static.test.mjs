import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('package manifest is a self-contained publishable web bundle', () => {
  assert.equal(pkg.name, 'dsh-mobile-access')
  assert.equal(pkg.private, undefined)
  assert.equal(pkg.publishConfig?.access, 'public')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  assert.deepEqual([...pkg.dsh.client.inject].sort(), [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-sidebar',
  ])
  assert.equal(pkg.exports['.'], './index.js')
  assert.equal(pkg.exports['./client'], './client.js')
  assert.equal(pkg.dependencies, undefined)
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}).sort(), ['@types/node', 'typescript'])
})

test('every runtime artifact and engineering deliverable exists', () => {
  for (const file of [
    'index.js',
    'service.js',
    'routes.js',
    'gateway.js',
    'html.js',
    'types.js',
    'client.js',
    'cordis.patch.yml',
    'locale/zh.json',
    'locale/en.json',
    'icon.svg',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'docs/architecture.md',
    'docs/security.md',
    'docs/runbook.md',
    'docs/engineering.md',
    'docs/acceptance.md',
    'scripts/build.mjs',
    'scripts/verify.sh',
  ]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, `missing ${file}`)
  }
})

test('host entry exports the expected Cordis shape', async () => {
  const module = await import('../index.js')
  assert.equal(module.name, 'dsh-mobile-access')
  assert.deepEqual([...module.inject], ['webServer', 'connection'])
  assert.equal(typeof module.apply, 'function')
})

test('route constants are exact and match the public contract', async () => {
  const module = await import('../routes.js')
  assert.equal(module.PAIR_PATH, '/m')
  assert.equal(module.STATE_PATH, '/api/mobile-access/state')
  assert.equal(module.ROTATE_PATH, '/api/mobile-access/rotate')
  assert.equal(typeof module.createPairingHandler, 'function')
  assert.equal(typeof module.registerMobileAccess, 'function')
})

test('client artifact is a single loader script with no unresolved placeholders', () => {
  const source = read('client.js')
  assert.equal(source.includes('__DICT_ZH__'), false)
  assert.equal(source.includes('__DICT_EN__'), false)
  assert.equal(source.includes('__PANEL_CSS__'), false)
  assert.match(source, /loader\.load\(\{ id: 'dsh-mobile-access', factory \}\)/)
  assert.equal((source.match(/require\('react'\)/g) ?? []).length, 1)
  assert.doesNotMatch(source, /^\s*(?:import|export)\s/m)
  assert.doesNotMatch(source, /from\s+['"]node:/)
  // Source modules stay under 500 lines each; this is the concatenated bundle.
  assert.equal(source.split('\n').length < 750, true)
})

test('client artifact carries the sidebar/main panel contract and theme tokens', () => {
  const source = read('client.js')
  assert.match(source, /sidebar\.panellist/)
  assert.match(source, /name: 'main'/)
  assert.match(source, /key: PANEL_ID/)
  assert.match(source, /--dsw-alias-/)
  assert.match(source, /installClipboardFallback/)
  assert.match(source, /installIOSInputZoomGuard/)
  assert.match(source, /dsh-ma-ios-input-zoom-guard/)
  assert.match(source, /font-size: 16px !important/)
  assert.match(source, /@media \(hover: none\) and \(pointer: coarse\)/)
  assert.match(source, /installIOSModelKeyboardGuard/)
  assert.match(source, /input\[role="searchbox"\]/)
  assert.match(source, /data-composer-card/)
  assert.match(source, /installIOSSidebarTapGuard/)
  assert.match(source, /data-row-key\^="session:"/)
  assert.match(source, /touch-action: manipulation/)
  assert.match(source, /touchend/)
  assert.match(source, /toggleSidebar/)
  assert.match(source, /isAppleMobile/)
})

test('locale dictionaries are complete and paired', () => {
  const zh = JSON.parse(read('locale/zh.json'))
  const en = JSON.parse(read('locale/en.json'))
  assert.equal(typeof zh.meta.title, 'string')
  assert.equal(typeof en.meta.title, 'string')
  assert.equal(zh.ui && typeof zh.ui === 'object', true)
  assert.equal(en.ui && typeof en.ui === 'object', true)
  assert.deepEqual(Object.keys(zh.ui).sort(), Object.keys(en.ui).sort())
  assert.equal(Object.keys(zh.ui).length >= 60, true)
})

test('pairing page has no script, no external asset, and a CSP', async () => {
  const module = await import('../html.js')
  const html = module.renderPairingPage({
    host: '192.0.2.10:3080',
    expiresAt: new Date(0).toISOString(),
    expired: false,
    locked: false,
    codeLength: 8,
    codeTtlMs: 600_000,
    nonce: 'abc123',
  })
  assert.match(html, /配对码/)
  assert.match(html, /name="nonce" value="abc123"/)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /https?:\/\/(?!192\.168)/)
  const csp = module.contentSecurityPolicy()
  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /form-action 'self'/)
})

test('icon is a small local svg and no packaged file escapes the allowlist', () => {
  const icon = statSync(new URL('../icon.svg', import.meta.url))
  assert.equal(icon.size > 0 && icon.size <= 256 * 1024, true)
  assert.match(read('icon.svg'), /^<svg[\s>]/)
  for (const file of pkg.files) {
    if (file.includes('*')) continue
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, `missing packaged file ${file}`)
  }
})

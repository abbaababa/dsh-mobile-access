import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const CLIENT = new URL('../client.js', import.meta.url)

function descriptor(object, key) {
  return Object.getOwnPropertyDescriptor(object, key)
}

function harness() {
  const registrations = []
  const cleanups = []
  const errors = []
  let definition
  let panel
  let icon
  const listeners = new Map()
  const execCommands = []

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial
      return [value, () => undefined]
    },
    useEffect(effect) {
      const cleanup = effect()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    useMemo(factory) { return factory() },
    useCallback(callback) { return callback },
    useRef(initial) { return { current: initial } },
    useSyncExternalStore(subscribe, getSnapshot) {
      subscribe(() => undefined)
      return getSnapshot()
    },
  }

  const locale = {
    register(namespace, dictionaries) {
      assert.equal(namespace, 'dsh-mobile-access')
      assert.equal(typeof dictionaries.zh, 'object')
      assert.equal(typeof dictionaries.en, 'object')
      return () => undefined
    },
    bind() { return (key) => `t:${key}` },
    getSnapshot() { return { revision: 1 } },
    subscribe() { return () => undefined },
  }

  const slots = {
    inject(name, effect) {
      const dispose = effect()
      return typeof dispose === 'function' ? dispose : () => undefined
    },
    register(options, component) {
      registrations.push({ options, component })
      if (options.name === 'main') panel = component
      if (options.name === 'sidebar.panellist') icon = component
      return () => undefined
    },
  }

  const context = {
    console: { error: (...args) => errors.push(args.join(' ')), warn: (...args) => errors.push(args.join(' ')) },
    window: {
      __ModuleLoader__: { load(value) { definition = value } },
      isSecureContext: false,
      innerWidth: 390,
      innerHeight: 844,
      visualViewport: { width: 390, height: 844 },
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      removeEventListener() {},
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      onLine: true,
    },
    document: {
      visibilityState: 'visible',
      body: { appendChild() {}, removeChild() {} },
      createElement: () => ({
        style: {},
        setAttribute() {},
        select() {},
        setSelectionRange() {},
        remove() {},
      }),
      addEventListener(type, listener) { listeners.set(type, listener) },
      removeEventListener(type) { listeners.delete(type) },
      querySelector() { return null },
      execCommand: (command, _show, value) => { execCommands.push([command, value]); return true },
    },
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          ok: true,
          version: 1,
          origin: 'http://192.0.2.10:3080',
          pairUrl: 'http://192.0.2.10:3080/m',
          bindHost: '192.0.2.10',
          protocol: 'http:',
          port: 3080,
          loopback: false,
          displayCode: '1234 5678',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          remainingMs: 600000,
          expired: false,
          locked: false,
          lastPairedAt: null,
          pairingCount: 0,
        }
      },
    }),
    localStorage: { setItem() {}, removeItem() {} },
    WebSocket: function WebSocket() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    Date,
    Math,
    JSON,
    String,
    Number,
    Object,
    Array,
    Error,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    Promise,
    console,
  }
  context.globalThis = context
  return { context, errors, registrations, listeners, execCommands, get definition() { return definition }, get panel() { return panel }, get icon() { return icon }, React, locale, slots }
}

test('client bundle registers the sidebar entry and renders the panel without throwing', async () => {
  const source = await readFile(CLIENT, 'utf8')
  const h = harness()
  vm.runInNewContext(source, h.context, { filename: 'client.js' })
  assert.ok(h.definition, 'loader.load must be called')
  assert.equal(h.definition.id, 'dsh-mobile-access')

  const plugin = h.definition.factory((id) => {
    assert.equal(id, 'react')
    return h.React
  })
  assert.deepEqual([...plugin.inject], ['slots', 'locale'])

  const effects = []
  plugin.apply({
    slots: h.slots,
    locale: h.locale,
    effect(effect) { effects.push(effect()) },
    logger: { error: (message) => h.errors.push(message), warn: (message) => h.errors.push(message) },
  })

  assert.equal(h.registrations.length, 2)
  assert.deepEqual(h.registrations.map((entry) => entry.options.name).sort(), ['main', 'sidebar.panellist'])
  const sidebar = h.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(sidebar.options.id, 'mobile-access')
  assert.equal(sidebar.options.order, 15)
  assert.equal(typeof sidebar.options.label, 'function')
  assert.equal(sidebar.options.label(), 't:panel')

  const tree = h.panel && h.panel({})
  assert.ok(tree, 'panel must return a React element')
  assert.equal(tree.props['data-testid'], 'mobile-access-panel')
  const icon = h.icon && h.icon({ size: 24, active: true })
  assert.equal(icon.type, 'svg')
  assert.equal(h.errors.length, 0, h.errors.join('\n'))

  // iOS + HTTP: the guarded fallback must be present while the plugin is active.
  assert.equal(typeof h.context.navigator.clipboard?.writeText, 'function')

  // iOS Return must look like Shift+Enter to Lexical so the native newline wins.
  const keydown = h.listeners.get('keydown')
  assert.equal(typeof keydown, 'function')
  let prevented = false
  const inComposer = {
    key: 'Enter',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    keyCode: 13,
    defaultPrevented: false,
    target: { closest: (selector) => selector === '[data-composer-input]' ? {} : null },
    preventDefault() { prevented = true },
    stopImmediatePropagation() {},
  }
  keydown(inComposer)
  assert.equal(inComposer.shiftKey, true)
  assert.equal(prevented, false, 'must let the browser perform the native newline')
  const outsideComposer = {
    ...inComposer,
    shiftKey: false,
    target: { closest: () => null },
  }
  keydown(outsideComposer)
  assert.equal(outsideComposer.shiftKey, false)

  // If the engine refuses the shiftKey shadow, fall back to an explicit edit.
  let fallbackPrevented = false
  let fallbackStopped = false
  const frozen = {
    ...inComposer,
    shiftKey: false,
    preventDefault() { fallbackPrevented = true },
    stopImmediatePropagation() { fallbackStopped = true },
  }
  Object.defineProperty(frozen, 'shiftKey', { configurable: false, enumerable: true, value: false, writable: false })
  keydown(frozen)
  assert.equal(frozen.shiftKey, false)
  assert.equal(fallbackPrevented, true)
  assert.equal(fallbackStopped, true)
  assert.equal(h.execCommands.at(-1)[0], 'insertLineBreak')

  for (const cleanup of effects.reverse()) cleanup()
  assert.equal(h.context.navigator.clipboard, undefined)
  assert.equal(h.listeners.has('keydown'), false)
})

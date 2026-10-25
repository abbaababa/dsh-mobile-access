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
  const headChildren = []
  let sidebarToggles = 0
  let sidebarCollapsed = false
  const emit = (type, event) => {
    const entry = listeners.get(type)
    const list = Array.isArray(entry) ? entry : entry === undefined ? [] : [entry]
    for (const listener of [...list]) listener(event)
  }

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

  class HTMLInputElement {
    constructor() {
      this.attributes = {}
      this.focused = false
    }
    getAttribute(name) { return this.attributes[name] ?? null }
    setAttribute(name, value) { this.attributes[name] = value }
    closest(selector) {
      return selector === 'input[role="searchbox"]' && this.getAttribute('role') === 'searchbox'
        ? this
        : null
    }
    focus() { this.focused = true }
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

  const layout = {
    toggleSidebar() { sidebarToggles += 1 },
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
      head: {
        appendChild(node) { headChildren.push(node) },
      },
      getElementById(id) { return headChildren.find((node) => node.id === id) ?? null },
      createElement(tagName) {
        return {
          tagName,
          id: '',
          textContent: '',
          style: {},
          setAttribute() {},
          select() {},
          setSelectionRange() {},
          remove() {
            const index = headChildren.indexOf(this)
            if (index >= 0) headChildren.splice(index, 1)
          },
        }
      },
      addEventListener(type, listener) {
        const entry = listeners.get(type)
        if (Array.isArray(entry)) entry.push(listener)
        else listeners.set(type, entry === undefined ? [listener] : [entry, listener])
      },
      removeEventListener(type, listener) {
        const entry = listeners.get(type)
        if (!Array.isArray(entry)) return
        const next = entry.filter((candidate) => candidate !== listener)
        if (next.length === 0) listeners.delete(type)
        else listeners.set(type, next)
      },
      querySelector(selector) {
        return selector === '[data-sidebar-collapsed]' && sidebarCollapsed ? {} : null
      },
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
          publicOrigin: 'http://192.0.2.10:3080',
          gateway: {
            available: false,
            running: false,
            starting: false,
            port: null,
            publicOrigin: null,
            lanAddresses: [],
            error: null,
          },
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
  context.HTMLInputElement = HTMLInputElement
  context.globalThis = context
  return { context, errors, registrations, listeners, execCommands, headChildren, layout, emit, set sidebarCollapsed(value) { sidebarCollapsed = value }, get sidebarToggles() { return sidebarToggles }, get definition() { return definition }, get panel() { return panel }, get icon() { return icon }, React, locale, slots }
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
  assert.deepEqual([...plugin.inject], ['slots', 'locale', 'layout'])

  const effects = []
  plugin.apply({
    slots: h.slots,
    locale: h.locale,
    layout: h.layout,
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

  // iOS Safari must not auto-zoom the 12px model search or the composer.
  const zoomGuard = h.headChildren.find((node) => node.id === 'dsh-ma-ios-input-zoom-guard')
  assert.ok(zoomGuard, 'iOS input zoom guard style must be installed')
  assert.match(zoomGuard.textContent, /@media \(hover: none\) and \(pointer: coarse\)/)
  assert.match(zoomGuard.textContent, /font-size: 16px !important/)
  assert.match(zoomGuard.textContent, /\[data-composer-input\]/)
  assert.match(zoomGuard.textContent, /\[role="searchbox"\]/)

  // iOS Return must look like Shift+Enter to Lexical so the native newline wins.
  const keydown = (event) => h.emit('keydown', event)
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

  // A programmatic focus of the model search must not open the keyboard until
  // the user actually taps that search field.
  const pointerdown = (event) => h.emit('pointerdown', event)
  const searchbox = new h.context.HTMLInputElement()
  searchbox.setAttribute('role', 'searchbox')
  searchbox.focus()
  assert.equal(searchbox.focused, false, 'guarded programmatic search focus must stay closed')
  pointerdown({ target: searchbox })
  searchbox.focus()
  assert.equal(searchbox.focused, true, 'a deliberate tap must allow native search focus')

  // Opening a composer menu must dismiss an already-open composer keyboard.
  let blurred = false
  h.context.document.activeElement = { blur() { blurred = true } }
  const trigger = {
    closest(selector) {
      if (selector === 'button[aria-haspopup="menu"]') return trigger
      if (selector === '[data-composer-card]') return {}
      return null
    },
  }
  pointerdown({ target: trigger })
  assert.equal(blurred, true, 'composer menu tap must blur the active field')

  // Safari focuses a clickable div carrying tabIndex before it dispatches click.
  // The iOS guard removes that attribute for the tap so the first tap switches
  // the session instead of only focusing the row.
  const touchstart = (event) => h.emit('touchstart', event)
  const row = {
    attributes: { tabindex: '0' },
    clickCount: 0,
    isConnected: true,
    click() { this.clickCount += 1 },
    getAttribute(name) { return this.attributes[name] ?? null },
    setAttribute(name, value) { this.attributes[name] = value },
    removeAttribute(name) { delete this.attributes[name] },
    closest(selector) { return selector === '[data-row-key^="session:"]' ? this : null },
  }
  touchstart({ target: row, changedTouches: [{ clientX: 0, clientY: 0 }] })
  assert.equal(row.getAttribute('tabindex'), null, 'first tap must not be consumed by focus')
  const touchend = (event) => h.emit('touchend', event)
  touchend({ changedTouches: [{ clientX: 0, clientY: 0 }] })
  assert.equal(row.clickCount, 1, 'first tap must activate the session row exactly once')
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(h.sidebarToggles, 1, 'the narrow sidebar must collapse after switching')

  // A horizontal swipe toggles the sidebar: right opens a collapsed rail,
  // left closes an expanded sidebar. The swipe target is outside controls.
  const swipeTarget = { closest: () => null }
  h.sidebarCollapsed = true
  touchstart({ touches: [{ clientX: 100, clientY: 420 }], changedTouches: [{ clientX: 100, clientY: 420 }], target: swipeTarget })
  touchend({ touches: [], changedTouches: [{ clientX: 220, clientY: 430 }] })
  assert.equal(h.sidebarToggles, 2, 'right swipe must open the collapsed sidebar')
  h.sidebarCollapsed = false
  touchstart({ touches: [{ clientX: 300, clientY: 420 }], changedTouches: [{ clientX: 300, clientY: 420 }], target: swipeTarget })
  touchend({ touches: [], changedTouches: [{ clientX: 180, clientY: 430 }] })
  assert.equal(h.sidebarToggles, 3, 'left swipe must close the expanded sidebar')

  for (const cleanup of effects.reverse()) cleanup()
  assert.equal(h.context.navigator.clipboard, undefined)
  assert.equal(h.listeners.has('keydown'), false)
  assert.equal(h.listeners.has('pointerdown'), false)
  assert.equal(h.listeners.has('touchstart'), false)
  assert.equal(h.listeners.has('touchend'), false)
  assert.equal(h.listeners.has('click'), false)
  assert.equal(h.headChildren.length, 0, 'zoom guard style must be removed on cleanup')
  const restored = new h.context.HTMLInputElement()
  restored.setAttribute('role', 'searchbox')
  restored.focus()
  assert.equal(restored.focused, true, 'cleanup must restore the native focus method')
})

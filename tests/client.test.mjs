import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const CLIENT = new URL('../client.js', import.meta.url)

function descriptor(object, key) {
  return Object.getOwnPropertyDescriptor(object, key)
}

function harness() {
  // A controllable clock keeps the 800ms swipe-duration gate deterministic.
  let clock = Date.now()
  class TestDate extends Date {
    static now() { return clock }
  }
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
  const frame = { style: { gridTemplateColumns: '280px minmax(0px, 1fr) minmax(0px, 0px)' } }
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
        if (selector === '[data-sidebar-collapsed]') return sidebarCollapsed ? {} : null
        if (selector === '[style*="grid-template-columns"]') return frame
        return null
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
    Date: TestDate,
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
  return { context, errors, registrations, listeners, execCommands, headChildren, layout, emit, advance(ms) { clock += ms }, set sidebarCollapsed(value) { sidebarCollapsed = value }, get sidebarToggles() { return sidebarToggles }, get definition() { return definition }, get panel() { return panel }, get icon() { return icon }, React, locale, slots }
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
  let sessionBlurred = false
  h.context.document.activeElement = { blur() { sessionBlurred = true } }
  touchstart({ target: row, changedTouches: [{ clientX: 0, clientY: 0 }] })
  assert.equal(row.getAttribute('tabindex'), null, 'first tap must not be consumed by focus')
  const touchend = (event) => h.emit('touchend', event)
  touchend({ changedTouches: [{ clientX: 0, clientY: 0 }] })
  assert.equal(sessionBlurred, true, 'switching a session must dismiss the open keyboard')
  assert.equal(row.clickCount, 1, 'first tap must activate the session row exactly once')
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(h.sidebarToggles, 1, 'the narrow sidebar must collapse after switching')

  // A late programmatic focus from the newly mounted conversation is suppressed,
  // but a composer tap that the user deliberately makes is allowed through.
  let composerBlurred = 0
  const composer = {
    closest(selector) { return selector.includes('[data-composer-input]') ? this : null },
    blur() { composerBlurred += 1 },
  }
  h.emit('focusin', { target: composer })
  assert.equal(composerBlurred, 1, 'post-switch composer focus must not open the keyboard')
  touchstart({ target: composer, changedTouches: [{ clientX: 10, clientY: 10 }] })
  h.emit('focusin', { target: composer })
  assert.equal(composerBlurred, 1, 'a deliberate composer tap must keep native focus')

  // A normal tap in the conversation content closes the expanded sidebar.
  const contentTarget = { closest: () => null }
  const togglesBeforeContentTap = h.sidebarToggles
  h.emit('click', { target: contentTarget, clientX: 320 })
  assert.equal(h.sidebarToggles, togglesBeforeContentTap + 1, 'a content tap must close the expanded sidebar')
  h.emit('click', { target: contentTarget, clientX: 100 })
  assert.equal(h.sidebarToggles, togglesBeforeContentTap + 1, 'a tap in the sidebar column must not toggle it')
  const buttonTarget = { closest: (selector) => selector.includes('button') ? {} : null }
  h.emit('click', { target: buttonTarget, clientX: 320 })
  assert.equal(h.sidebarToggles, togglesBeforeContentTap + 1, 'an interactive target must keep its click')

  // Right swipe on iPhone opens the collapsed sidebar. The gesture used to be
  // silently dead whenever the finger started on a plan card, because every
  // card is wrapped in a <button> and buttons were on the block list. Cards
  // must stay swipeable; only the click Safari synthesises after a recognised
  // swipe is cancelled, so the card is not activated by the gesture.
  const swipeTarget = { closest: () => null }
  const cardButtonTarget = {
    closest(selector) {
      // Mirrors the real DOM: the touched node sits inside a <button>, so only
      // an explicit standalone "button" selector matches.
      return /(^|,)\s*button(\s|,|$)/.test(selector) ? {} : null
    },
  }
  const swipe = (from, to, options = {}) => {
    h.advance(options.waitBefore ?? 1000)
    h.sidebarCollapsed = options.collapsed ?? true
    touchstart({
      touches: [{ clientX: from.x, clientY: from.y }],
      changedTouches: [{ clientX: from.x, clientY: from.y }],
      target: options.target ?? swipeTarget,
    })
    h.advance(options.elapsed ?? 120)
    if (options.cancel === true) h.emit('touchcancel', {})
    else touchend({ touches: [], changedTouches: [{ clientX: to.x, clientY: to.y }] })
  }
  const togglesBeforeSwipe = h.sidebarToggles

  swipe({ x: 100, y: 420 }, { x: 220, y: 430 })
  assert.equal(h.sidebarToggles, togglesBeforeSwipe + 1, 'right swipe must open the collapsed sidebar')

  // The regression the user hit: the swipe starts on a plan card button.
  swipe({ x: 100, y: 420 }, { x: 240, y: 425 }, { target: cardButtonTarget })
  assert.equal(
    h.sidebarToggles,
    togglesBeforeSwipe + 2,
    'a right swipe that starts on a card button must still open the sidebar',
  )

  // The click fired on release must be swallowed instead of tapping the card.
  let suppressedPrevented = false
  let suppressedStopped = false
  h.emit('click', {
    target: cardButtonTarget,
    clientX: 240,
    preventDefault() { suppressedPrevented = true },
    stopImmediatePropagation() { suppressedStopped = true },
  })
  assert.equal(suppressedPrevented, true, 'the synthetic click after a recognised swipe must be prevented')
  assert.equal(suppressedStopped, true, 'the synthetic click must be stopped before it reaches the card')
  assert.equal(h.sidebarToggles, togglesBeforeSwipe + 2, 'the swallowed click must not toggle the sidebar again')

  // After the suppression window a deliberate tap must click normally again.
  h.advance(1000)
  let laterPrevented = false
  h.emit('click', { target: cardButtonTarget, clientX: 240, preventDefault() { laterPrevented = true }, stopImmediatePropagation() {} })
  assert.equal(laterPrevented, false, 'a later deliberate tap must not be suppressed')

  // Left swipes, short drags, vertical drags, slow drags, edge starts,
  // multi-touch and cancelled touches must all stay inert.
  swipe({ x: 300, y: 420 }, { x: 180, y: 430 })
  swipe({ x: 100, y: 420 }, { x: 160, y: 425 })
  swipe({ x: 100, y: 420 }, { x: 200, y: 640 })
  swipe({ x: 100, y: 420 }, { x: 220, y: 430 }, { elapsed: 900 })
  swipe({ x: 10, y: 420 }, { x: 200, y: 430 })
  swipe({ x: 380, y: 420 }, { x: 200, y: 430 })
  swipe({ x: 100, y: 420 }, { x: 220, y: 430 }, { cancel: true })
  h.advance(1000)
  h.sidebarCollapsed = true
  touchstart({
    touches: [{ clientX: 100, clientY: 420 }, { clientX: 140, clientY: 420 }],
    changedTouches: [{ clientX: 100, clientY: 420 }],
    target: swipeTarget,
  })
  h.advance(120)
  touchend({ touches: [], changedTouches: [{ clientX: 260, clientY: 430 }] })
  assert.equal(h.sidebarToggles, togglesBeforeSwipe + 2, 'only the two valid right swipes may toggle the sidebar')

  // An installed PWA has no system back/forward swipe, so an edge start is
  // allowed there even though a normal Safari tab must avoid it.
  const originalMatchMedia = h.context.window.matchMedia
  h.context.window.matchMedia = (query) => ({ matches: query === '(display-mode: standalone)' })
  swipe({ x: 10, y: 420 }, { x: 200, y: 430 })
  h.context.window.matchMedia = originalMatchMedia
  assert.equal(h.sidebarToggles, togglesBeforeSwipe + 3, 'an installed PWA may start the swipe at the screen edge')

  for (const cleanup of effects.reverse()) cleanup()
  assert.equal(h.context.navigator.clipboard, undefined)
  assert.equal(h.listeners.has('keydown'), false)
  assert.equal(h.listeners.has('pointerdown'), false)
  assert.equal(h.listeners.has('touchstart'), false)
  assert.equal(h.listeners.has('touchend'), false)
  assert.equal(h.listeners.has('touchcancel'), false)
  assert.equal(h.listeners.has('focusin'), false)
  assert.equal(h.listeners.has('click'), false)
  assert.equal(h.headChildren.length, 0, 'zoom guard style must be removed on cleanup')
  const restored = new h.context.HTMLInputElement()
  restored.setAttribute('role', 'searchbox')
  restored.focus()
  assert.equal(restored.focused, true, 'cleanup must restore the native focus method')
})

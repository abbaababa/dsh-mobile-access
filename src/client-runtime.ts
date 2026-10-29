const STATE_PATH = '/api/mobile-access/state'
const ROTATE_PATH = '/api/mobile-access/rotate'

interface ReactRuntime {
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void]
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  useCallback<T>(callback: T, deps: readonly unknown[]): T
  useRef<T>(initial: T): { current: T }
  useSyncExternalStore<T>(subscribe: (onChange: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T
}

interface SlotService {
  inject(name: string, effect: () => () => void): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

interface LocaleService {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string
  getSnapshot(): { readonly revision: number }
  subscribe(listener: () => void): () => void
}

interface LayoutService {
  toggleSidebar(): void
}

interface ClientContext {
  readonly slots: SlotService
  readonly layout?: LayoutService
  readonly locale?: LocaleService
  effect(execute: () => void | (() => void), label?: string): void
  readonly logger?: {
    info?(message: string): void
    warn?(message: string): void
    error?(message: string): void
  }
}

interface ClientModule {
  readonly inject?: readonly string[]
  readonly apply: (ctx: ClientContext) => void
}

interface MobileAccessState {
  readonly ok: true
  readonly version: number
  readonly origin: string
  readonly publicOrigin: string
  readonly pairUrl: string
  readonly bindHost: string
  readonly protocol: string
  readonly port: number
  readonly loopback: boolean
  readonly gateway: {
    readonly available: boolean
    readonly running: boolean
    readonly starting: boolean
    readonly port: number | null
    readonly publicOrigin: string | null
    readonly lanAddresses: readonly string[]
    readonly error: string | null
  }
  readonly displayCode: string
  readonly expiresAt: string
  readonly remainingMs: number
  readonly expired: boolean
  readonly locked: boolean
  readonly lastPairedAt: string | null
  readonly pairingCount: number
}

interface CheckResult {
  readonly label: string
  readonly status: 'pass' | 'warn' | 'fail'
  readonly detail: string
}

let React: ReactRuntime
const h = (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown =>
  React.createElement(type, props, ...children)

function useLocaleRevision(locale: LocaleService | undefined): void {
  const subscribe = React.useCallback((onChange: () => void) => {
    if (locale === undefined) return () => undefined
    return locale.subscribe(onChange)
  }, [locale])
  const getSnapshot = React.useCallback(() => locale?.getSnapshot().revision ?? 0, [locale])
  React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function isAppleMobile(): boolean {
  const navigatorLike = navigator as Navigator & { platform?: string; maxTouchPoints?: number }
  return /iPad|iPhone|iPod/.test(navigatorLike.userAgent)
    || (navigatorLike.platform === 'MacIntel' && (navigatorLike.maxTouchPoints ?? 0) > 1)
}

function legacyCopy(value: string): boolean {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.left = '-1000px'
  area.style.opacity = '0'
  area.style.fontSize = '16px'
  document.body.appendChild(area)
  let copied = false
  try {
    area.select()
    area.setSelectionRange(0, value.length)
    copied = document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    area.remove()
  }
  return copied
}

async function copyText(value: string): Promise<boolean> {
  const clipboard = (navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard
  if (clipboard?.writeText !== undefined) {
    try {
      await clipboard.writeText(value)
      return true
    } catch {
      return legacyCopy(value)
    }
  }
  return legacyCopy(value)
}

/**
 * On iPhone/iPad the software keyboard has no Shift+Return. The official
 * composer treats a plain Enter as "send", so a narrow capture-phase listener
 * makes the event look like Shift+Enter to Lexical: the composer then keeps
 * its native line break and does not submit. Mac and non-Apple platforms are
 * never touched. The visible send button remains the send path.
 */
function installIOSReturnNewline(): () => void {
  if (!isAppleMobile()) return () => undefined
  const doc = document
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.defaultPrevented) return
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.isComposing || event.keyCode === 229) return
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function') return
    if (target.closest('[data-composer-input]') === null) return
    if (doc.querySelector('[data-composer-overlay] [role="listbox"]') !== null) return
    try {
      Object.defineProperty(event, 'shiftKey', { configurable: true, value: true })
    } catch {
      // Fall through to the explicit edit fallback.
    }
    const currentShift = (event as unknown as { shiftKey: boolean }).shiftKey
    if (currentShift !== true) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!doc.execCommand('insertLineBreak')) doc.execCommand('insertText', false, '\n')
    }
  }
  doc.addEventListener('keydown', onKeyDown, true)
  return () => doc.removeEventListener('keydown', onKeyDown, true)
}

/**
 * On iOS an HTTP LAN page has no `navigator.clipboard`. A few existing DSH
 * controls call it directly, so install a narrowly scoped fallback there only.
 * The original descriptor is restored when the plugin is disposed.
 */
function installClipboardFallback(): () => void {
  if (!isAppleMobile() || window.isSecureContext) return () => undefined
  const navigatorLike = navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }
  if (navigatorLike.clipboard?.writeText !== undefined) return () => undefined
  const fallback = {
    writeText: async (value: string): Promise<void> => {
      if (!legacyCopy(value)) throw new Error('clipboard fallback failed')
    },
  }
  const prototype = Object.getPrototypeOf(navigator) as object | null
  const targets = [prototype, navigator].filter((target): target is object => target !== null)
  for (const target of targets) {
    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(target, 'clipboard')
      if (descriptor?.configurable === false) continue
      Object.defineProperty(target, 'clipboard', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        value: fallback,
      })
    } catch {
      continue
    }
    return () => {
      try {
        if (descriptor === undefined) {
          delete (target as { clipboard?: unknown }).clipboard
        } else {
          Object.defineProperty(target, 'clipboard', descriptor)
        }
      } catch {
        // A host page that froze the descriptor wins; never throw during cleanup.
      }
    }
  }
  return () => undefined
}

/**
 * iOS Safari auto-zooms a focused input, textarea, select or contenteditable
 * whose computed font-size is below 16px. The official model picker's search
 * field is 12px and the composer's editor is 14px, so tapping the model chip
 * or its search box zooms the page and leaves the fixed-position model menu
 * partly off-screen. Force only those editable controls to 16px on coarse
 * pointers; Mac (fine pointer / hover) is untouched, and pinch zoom remains
 * available because the viewport meta is not changed.
 */
const IOS_INPUT_ZOOM_GUARD_ID = 'dsh-ma-ios-input-zoom-guard'
const IOS_INPUT_ZOOM_GUARD_CSS = `@media (hover: none) and (pointer: coarse) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  textarea,
  select,
  [contenteditable="true"],
  [data-composer-input],
  [role="searchbox"],
  [role="textbox"] {
    font-size: 16px !important;
  }
  button,
  [role="button"],
  [role="menuitem"],
  [role="menuitemradio"],
  [data-row-key^="session:"],
  [role="treeitem"] {
    touch-action: manipulation;
    -webkit-user-drag: none;
  }
}`

function installIOSInputZoomGuard(): () => void {
  if (!isAppleMobile()) return () => undefined
  document.getElementById(IOS_INPUT_ZOOM_GUARD_ID)?.remove()
  const style = document.createElement('style')
  style.id = IOS_INPUT_ZOOM_GUARD_ID
  style.textContent = IOS_INPUT_ZOOM_GUARD_CSS
  document.head.appendChild(style)
  return () => style.remove()
}

/**
 * Safari treats a touch on a focusable, non-button row as a focus step: the
 * first tap focuses the row and only the second tap reaches its click handler.
 * Official session rows are `role="treeitem"` divs with `tabIndex={0}`, so
 * switching sessions on iPhone takes two taps. Remove that one attribute for
 * the duration of the tap, activate the row on the first tap ourselves, and
 * collapse the narrow sidebar after the switch. Mac and keyboard users are
 * untouched; `touch-action: manipulation` in the iOS stylesheet removes the
 * legacy double-tap-zoom delay.
 */
function installIOSSidebarTapGuard(layout?: LayoutService): () => void {
  if (!isAppleMobile()) return () => undefined
  const doc = document
  const timers = new Set<number>()
  let pending: { row: HTMLElement; x: number; y: number; startedAt: number } | null = null
  let syntheticClick = false
  let suppressNativeClick = false
  let suppressComposerFocusUntil = 0
  let allowComposerFocus = false
  let composerFocusTimer: number | undefined
  const isAction = (target: Element): boolean =>
    target.closest('button, a, input, textarea, select, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="switch"], [data-row-actions]') !== null
  const isComposer = (target: EventTarget | null): boolean => {
    const element = target as Element | null
    return element !== null
      && typeof element.closest === 'function'
      && element.closest('[data-composer-input], [data-composer-card] [contenteditable="true"]') !== null
  }
  const blurActive = (): void => {
    const active = doc.activeElement as { blur?: () => void } | null
    try {
      active?.blur?.()
    } catch {
      // Focus may already have moved; a stale activeElement is harmless.
    }
  }
  const onFocusIn = (event: Event): void => {
    if (Date.now() >= suppressComposerFocusUntil) return
    if (!isComposer(event.target)) return
    if (allowComposerFocus) {
      allowComposerFocus = false
      return
    }
    try {
      (event.target as HTMLElement).blur()
    } catch {
      // The element may be gone already; never break the page's focus flow.
    }
  }
  const point = (event: Event): { x: number; y: number } | null => {
    const touches = (event as TouchEvent).changedTouches ?? (event as TouchEvent).touches
    const touch = touches?.[0]
    return touch === undefined ? null : { x: touch.clientX, y: touch.clientY }
  }
  const onTouchStart = (event: Event): void => {
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function') return
    if (isComposer(target)) {
      allowComposerFocus = true
      if (composerFocusTimer !== undefined) window.clearTimeout(composerFocusTimer)
      composerFocusTimer = window.setTimeout(() => {
        composerFocusTimer = undefined
        allowComposerFocus = false
      }, 500)
    }
    if (isAction(target)) {
      pending = null
      return
    }
    const row = target.closest('[data-row-key^="session:"]') as HTMLElement | null
    if (row === null) return
    const at = point(event)
    if (at === null) return
    pending = { row, x: at.x, y: at.y, startedAt: Date.now() }
    const tabindex = row.getAttribute('tabindex')
    if (tabindex === null) return
    row.removeAttribute('tabindex')
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      if (row.isConnected) row.setAttribute('tabindex', tabindex)
    }, 400)
    timers.add(timer)
  }
  const onClickCapture = (event: Event): void => {
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function' || target.closest('[data-row-key^="session:"]') === null) return
    if (syntheticClick) {
      syntheticClick = false
      suppressNativeClick = true
      return
    }
    if (!suppressNativeClick) return
    suppressNativeClick = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onTouchEnd = (event: Event): void => {
    if (pending === null) return
    const { row, x, y, startedAt } = pending
    pending = null
    if (!row.isConnected) return
    const at = point(event)
    if (at === null) return
    if (Math.hypot(at.x - x, at.y - y) > 10 || Date.now() - startedAt > 600) return
    suppressComposerFocusUntil = Date.now() + 800
    allowComposerFocus = false
    blurActive()
    syntheticClick = true
    row.click()
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      syntheticClick = false
      suppressNativeClick = false
    }, 500)
    timers.add(timer)
    if (window.innerWidth < 1024) {
      window.setTimeout(() => {
        try {
          layout?.toggleSidebar()
        } catch {
          // Layout teardown must never break the row activation.
        }
      }, 0)
    }
  }
  doc.addEventListener('touchstart', onTouchStart, true)
  doc.addEventListener('touchend', onTouchEnd, true)
  doc.addEventListener('click', onClickCapture, true)
  doc.addEventListener('focusin', onFocusIn, true)
  return () => {
    doc.removeEventListener('touchstart', onTouchStart, true)
    doc.removeEventListener('touchend', onTouchEnd, true)
    doc.removeEventListener('click', onClickCapture, true)
    doc.removeEventListener('focusin', onFocusIn, true)
    if (composerFocusTimer !== undefined) window.clearTimeout(composerFocusTimer)
    for (const timer of timers) window.clearTimeout(timer)
    timers.clear()
  }
}

/**
 * Right swipe on iPhone opens the left sidebar. The closing gesture is a tap
 * on the content area (not a left swipe): a normal tap is easier to discover
 * and does not compete with horizontal scrolling. The swipe is scoped to the
 * content area and ignores vertical movement, text/selection controls, menus,
 * code blocks and the right panel. Plain buttons and links stay swipeable:
 * whole cards are wrapped in a <button>, so excluding them silently disabled
 * the gesture on most of the content. The click that would follow a recognised
 * swipe is cancelled instead. On a normal Safari tab we stay 24px away from the
 * screen edges so the system back/forward gesture keeps priority; an installed
 * PWA has no such gesture, so edge starts are allowed there. Mac never installs
 * this listener.
 */
function installIOSSidebarSwipeGuard(layout?: LayoutService): () => void {
  if (!isAppleMobile() || layout === undefined) return () => undefined
  const doc = document
  let pending: { x: number; y: number; startedAt: number } | null = null
  let suppressClickUntil = 0
  // Hard blockers only: controls that own a horizontal drag themselves (text
  // selection, sliders, code blocks, the composer, menus, the right panel).
  // Plain buttons and links are deliberately allowed; the synthetic click that
  // Safari fires after a swipe is cancelled in onClickCapture instead.
  const isBlocked = (target: Element): boolean =>
    target.closest('input, textarea, select, [contenteditable="true"], [data-composer-card], pre, code, [role="slider"], [data-rightbar], [role="menu"], [role="listbox"]') !== null
  const point = (event: Event): { x: number; y: number } | null => {
    const touches = (event as TouchEvent).changedTouches ?? (event as TouchEvent).touches
    const touch = touches?.[0]
    return touch === undefined ? null : { x: touch.clientX, y: touch.clientY }
  }
  const isStandaloneDisplay = (): boolean => {
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
    try {
      return window.matchMedia('(display-mode: standalone)').matches === true
    } catch {
      return false
    }
  }
  const onClickCapture = (event: Event): void => {
    if (Date.now() > suppressClickUntil) return
    suppressClickUntil = 0
    try {
      event.preventDefault()
      event.stopImmediatePropagation()
    } catch {
      // A synthetic click that cannot be cancelled is still harmless.
    }
  }
  const onTouchCancel = (): void => {
    pending = null
  }
  const onTouchStart = (event: Event): void => {
    pending = null
    const touches = (event as TouchEvent).touches
    if (touches !== undefined && touches.length !== 1) return
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function' || isBlocked(target)) return
    const at = point(event)
    if (at === null) return
    if (!isStandaloneDisplay() && (at.x < 24 || at.x > window.innerWidth - 24)) return
    pending = { x: at.x, y: at.y, startedAt: Date.now() }
  }
  const onTouchEnd = (event: Event): void => {
    if (pending === null) return
    const { x, y, startedAt } = pending
    pending = null
    if (Date.now() - startedAt > 800) return
    const at = point(event)
    if (at === null) return
    const dx = at.x - x
    const dy = at.y - y
    // Signed delta: only a rightward drag opens the collapsed rail. The old
    // Math.abs(dx) check let a left swipe open it too, contradicting the
    // documented "right swipe opens" behaviour.
    if (dx < 70 || dx <= Math.abs(dy) * 1.5) return
    const collapsed = doc.querySelector('[data-sidebar-collapsed]') !== null
    if (!collapsed) return
    // The finger may have started on a button, so cancel the click that would
    // otherwise fire on release and re-activate that button.
    suppressClickUntil = Date.now() + 600
    try {
      layout.toggleSidebar()
    } catch {
      // Layout teardown must never break a gesture.
    }
  }
  doc.addEventListener('touchstart', onTouchStart, true)
  doc.addEventListener('touchend', onTouchEnd, true)
  doc.addEventListener('touchcancel', onTouchCancel, true)
  doc.addEventListener('click', onClickCapture, true)
  return () => {
    doc.removeEventListener('touchstart', onTouchStart, true)
    doc.removeEventListener('touchend', onTouchEnd, true)
    doc.removeEventListener('touchcancel', onTouchCancel, true)
    doc.removeEventListener('click', onClickCapture, true)
  }
}

/**
 * A tap on the conversation content closes an expanded narrow sidebar. It has
 * to run in the bubble phase so message links and buttons still receive their
 * click first, and it skips every interactive/row/right-panel target. The
 * sidebar width comes from the frame's inline grid template, so a tap on the
 * left column is not mistaken for content. Mac and wide layouts are untouched.
 */
function installIOSContentTapCollapse(layout?: LayoutService): () => void {
  if (!isAppleMobile() || layout === undefined) return () => undefined
  const doc = document
  const interactive = 'button, a, input, textarea, select, pre, code, [contenteditable="true"], [data-composer-card], [data-row-key], [role="treeitem"], [role="tree"], nav, [role="menu"], [role="listbox"], [role="button"], [role="menuitem"], [data-rightbar]'
  const onClick = (event: Event): void => {
    if (window.innerWidth >= 1024) return
    if (doc.querySelector('[data-sidebar-collapsed]') !== null) return
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function' || target.closest(interactive) !== null) return
    const frame = doc.querySelector('[style*="grid-template-columns"]') as HTMLElement | null
    const first = frame?.style.gridTemplateColumns.split(' ')[0] ?? ''
    const width = Number.parseFloat(first)
    const x = (event as MouseEvent).clientX
    if (Number.isFinite(width) && x < width) return
    try {
      layout.toggleSidebar()
    } catch {
      // Layout teardown must never break a click.
    }
  }
  doc.addEventListener('click', onClick, true)
  return () => doc.removeEventListener('click', onClick, true)
}

/**
 * The official model menu can move focus into its search field while it opens.
 * On iPhone that opens the software keyboard and shifts the fixed-position menu
 * above the visible viewport. Suppress only programmatic search-box focus until
 * the user deliberately taps that field; blur a focused composer control before
 * any composer menu opens. Native taps still focus normally, and Mac is untouched.
 */
function installIOSModelKeyboardGuard(): () => void {
  if (!isAppleMobile()) return () => undefined
  if (typeof HTMLInputElement === 'undefined') return () => undefined
  const doc = document
  const allowed = new WeakSet<HTMLInputElement>()
  const onPointerDown = (event: Event): void => {
    const target = event.target as Element | null
    if (target === null || typeof target.closest !== 'function') return
    const search = target.closest('input[role="searchbox"]') as HTMLInputElement | null
    if (search !== null) {
      allowed.add(search)
      return
    }
    const trigger = target.closest('button[aria-haspopup="menu"]')
    if (trigger === null || trigger.closest('[data-composer-card]') === null) return
    const active = doc.activeElement as { blur?: () => void } | null
    if (active !== null && active !== trigger && typeof active.blur === 'function') {
      try {
        active.blur()
      } catch {
        // A non-HTMLElement active element is harmless here.
      }
    }
  }
  const prototype = HTMLInputElement.prototype
  const originalFocus = prototype.focus
  const guardedFocus = function (this: HTMLInputElement, options?: FocusOptions): void {
    if (this.getAttribute('role') === 'searchbox' && !allowed.has(this)) return
    originalFocus.call(this, options)
  }
  Object.defineProperty(prototype, 'focus', {
    configurable: true,
    writable: true,
    value: guardedFocus,
  })
  doc.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true)
    if (prototype.focus === guardedFocus) {
      Object.defineProperty(prototype, 'focus', {
        configurable: true,
        writable: true,
        value: originalFocus,
      })
    }
  }
}


function useMobileAccessState(): {
  readonly state: MobileAccessState | null
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => Promise<void>
} {
  const [state, setState] = React.useState<MobileAccessState | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const alive = React.useRef(true)
  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(STATE_PATH, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json() as MobileAccessState
      if (payload?.ok !== true || typeof payload.expiresAt !== 'string') throw new Error('invalid state payload')
      if (alive.current) setState(payload)
    } catch (caught) {
      if (alive.current) setError(caught instanceof Error ? caught.message : 'request failed')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    alive.current = true
    void reload()
    const onFocus = (): void => { void reload() }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void reload()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive.current = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reload])

  return { state, loading, error, reload }
}

function useRemaining(expiresAt: string | undefined): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (expiresAt === undefined) return
    const expiry = new Date(expiresAt).getTime()
    if (Number.isNaN(expiry) || Date.now() >= expiry) return
    const timer = window.setInterval(() => {
      const value = Date.now()
      setNow(value)
      if (value >= expiry) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])
  if (expiresAt === undefined) return 0
  const expiry = new Date(expiresAt).getTime()
  return Number.isNaN(expiry) ? 0 : Math.max(0, expiry - now)
}

function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function runChecks(): Promise<CheckResult[]> {
  const checks: CheckResult[] = []
  checks.push(await copyText('D-SH-MOBILE-ACCESS-SELFTEST').then(
    (ok): CheckResult => ({ label: 'clipboard', status: ok ? 'pass' : 'fail', detail: ok ? 'writeText' : 'blocked' }),
  ))
  const cryptoLike = (globalThis as unknown as { crypto?: { getRandomValues?: unknown } }).crypto
  checks.push({
    label: 'crypto',
    status: typeof cryptoLike?.getRandomValues === 'function' ? 'pass' : 'fail',
    detail: typeof cryptoLike?.getRandomValues === 'function' ? 'getRandomValues' : 'missing',
  })
  try {
    const key = '__dsh_mobile_access_probe__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    checks.push({ label: 'storage', status: 'pass', detail: 'localStorage' })
  } catch {
    checks.push({ label: 'storage', status: 'warn', detail: 'unavailable or private mode' })
  }
  checks.push({
    label: 'websocket',
    status: typeof WebSocket === 'function' ? 'pass' : 'fail',
    detail: typeof WebSocket === 'function' ? 'constructor' : 'missing',
  })
  checks.push({
    label: 'viewport',
    status: window.visualViewport != null ? 'pass' : 'warn',
    detail: `${window.innerWidth}×${window.innerHeight}${window.visualViewport != null ? ` / vv ${Math.round(window.visualViewport.width)}` : ''}`,
  })
  checks.push({
    label: 'network',
    status: navigator.onLine ? 'pass' : 'warn',
    detail: navigator.onLine ? 'online' : 'offline',
  })
  return checks
}

function statusOf(state: MobileAccessState | null, loading: boolean, error: string | null, t: (key: string) => string): {
  readonly label: string
  readonly tone: 'ok' | 'warn' | 'bad' | 'muted'
} {
  if (error !== null) return { label: t('statusError'), tone: 'bad' }
  if (state === null) return { label: loading ? t('statusLoading') : t('statusError'), tone: 'muted' }
  if (state.loopback) {
    if (state.gateway.running) return { label: t('statusGateway'), tone: 'ok' }
    if (state.gateway.starting) return { label: t('statusGatewayStarting'), tone: 'warn' }
    return { label: t('statusLoopback'), tone: 'bad' }
  }
  if (state.locked) return { label: t('statusLocked'), tone: 'bad' }
  if (state.expired) return { label: t('statusExpired'), tone: 'warn' }
  return { label: t('statusReady'), tone: 'ok' }
}

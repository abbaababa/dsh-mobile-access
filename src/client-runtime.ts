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

interface ClientContext {
  readonly slots: SlotService
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
  readonly pairUrl: string
  readonly bindHost: string
  readonly protocol: string
  readonly port: number
  readonly loopback: boolean
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
  if (state.loopback) return { label: t('statusLoopback'), tone: 'bad' }
  if (state.locked) return { label: t('statusLocked'), tone: 'bad' }
  if (state.expired) return { label: t('statusExpired'), tone: 'warn' }
  return { label: t('statusReady'), tone: 'ok' }
}

const NS = 'dsh-mobile-access'
const PANEL_ID = 'mobile-access'

declare const __DICT_ZH__: Record<string, string>
declare const __DICT_EN__: Record<string, string>
const ZH = __DICT_ZH__
const EN = __DICT_EN__

function createPanel(t: (key: string) => string, locale: LocaleService | undefined): (props: Record<string, unknown>) => unknown {
  return function MobileAccessPanel(): unknown {
    useLocaleRevision(locale)
    const { state, loading, error, reload } = useMobileAccessState()
    const [rotating, setRotating] = React.useState(false)
    const [testing, setTesting] = React.useState(false)
    const [checks, setChecks] = React.useState<readonly CheckResult[] | null>(null)
    const [toast, setToast] = React.useState<string | null>(null)
    const toastTimer = React.useRef<number | undefined>(undefined)
    const remaining = useRemaining(state?.expiresAt)
    const status = statusOf(state, loading, error, t)
    const publicReady = state?.gateway.running === true && state.gateway.publicOrigin !== null
    const isIOS = isAppleMobile()
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches

    const flash = (message: string): void => {
      setToast(message)
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 2400)
    }
    React.useEffect(() => () => {
      if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current)
    }, [])

    const copy = async (value: string): Promise<void> => {
      flash(await copyText(value) ? t('copied') : t('copyFailed'))
    }
    const rotate = async (): Promise<void> => {
      setRotating(true)
      try {
        const response = await fetch(ROTATE_PATH, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await reload()
        flash(t('toastRotated'))
      } catch {
        flash(t('rotateFailed'))
      } finally {
        setRotating(false)
      }
    }
    const selfTest = async (): Promise<void> => {
      setTesting(true)
      try {
        setChecks(await runChecks())
      } finally {
        setTesting(false)
      }
    }

    const labels: Record<string, string> = {
      clipboard: t('checkClipboard'),
      crypto: t('checkCrypto'),
      storage: t('checkStorage'),
      websocket: t('checkWebSocket'),
      viewport: t('checkViewport'),
      network: t('checkOnline'),
    }
    const statusText: Record<CheckResult['status'], string> = {
      pass: t('checkPass'),
      warn: t('checkWarn'),
      fail: t('checkFail'),
    }

    const codeBlock = state === null
      ? null
      : h('div', { className: 'dsh-ma-card dsh-ma-pair' },
          h('div', { className: 'dsh-ma-row' },
            h('div', null,
              h('p', { className: 'dsh-ma-label' }, t('codeLabel')),
              h('div', { className: 'dsh-ma-code', 'aria-label': t('codeAria') }, state.displayCode),
              h('p', { className: 'dsh-ma-hint' }, t('codeHint')),
            ),
            h('div', { className: `dsh-ma-pill ${state.loopback || state.locked ? 'is-bad' : state.expired ? 'is-warn' : 'is-ok'}` },
              h('span', { className: 'dsh-ma-dot' }),
              status.label,
            ),
          ),
          h('div', { className: 'dsh-ma-actions' },
            h('button', { type: 'button', className: 'dsh-ma-button primary', onClick: () => { void copy(state.pairUrl) }, disabled: state.loopback && !publicReady }, t('copyLink')),
            h('button', { type: 'button', className: 'dsh-ma-button', onClick: () => { void copy(state.displayCode) } }, t('copyCode')),
            h('button', { type: 'button', className: 'dsh-ma-button', onClick: () => { void rotate() }, disabled: rotating }, rotating ? t('rotating') : t('rotate')),
          ),
          h('dl', { className: 'dsh-ma-meta' },
            h('div', null, h('dt', null, t('expiry')), h('dd', null, new Date(state.expiresAt).toLocaleTimeString(undefined, { hour12: false }))),
            h('div', null, h('dt', null, t('expiresIn')), h('dd', { className: remaining === 0 ? 'is-bad' : '' }, remaining === 0 ? t('expired') : formatRemaining(remaining))),
            h('div', null, h('dt', null, t('lastPaired')), h('dd', null, state.lastPairedAt === null ? t('never') : new Date(state.lastPairedAt).toLocaleString(undefined, { hour12: false }))),
            h('div', null, h('dt', null, t('pairCount')), h('dd', null, String(state.pairingCount))),
          ),
        )

    return h('div', { className: 'dsh-ma', 'data-testid': 'mobile-access-panel', 'data-state': status.tone },
      h('style', null, STYLES),
      h('div', { className: 'dsh-ma-inner', role: 'region', 'aria-label': t('mainAria') },
        h('header', { className: 'dsh-ma-head' },
          h('div', { className: 'dsh-ma-mark' }, 'D'),
          h('div', null,
            h('h1', null, t('title')),
            h('p', null, t('subtitle')),
          ),
        ),
        h('div', { className: 'dsh-ma-card dsh-ma-url' },
          h('p', { className: 'dsh-ma-label' }, t('urlLabel')),
          state === null
            ? h('p', { className: 'dsh-ma-hint' }, loading ? t('statusLoading') : t('statusError'))
            : h('code', null, state.pairUrl),
          h('p', { className: 'dsh-ma-hint' }, t('urlHint')),
          state?.loopback
            ? state.gateway.running
              ? h('div', { className: 'dsh-ma-alert is-ok' },
                  h('strong', null, t('gatewayTitle')),
                  h('p', null, t('gatewayBody')),
                  state.gateway.publicOrigin === null ? null : h('code', null, state.gateway.publicOrigin),
                )
              : h('div', { className: 'dsh-ma-alert' },
                  h('strong', null, state.gateway.starting ? t('gatewayStartingTitle') : t('loopbackTitle')),
                  h('p', null, state.gateway.error ?? t('loopbackBody')),
                )
            : null,
        ),
        error !== null ? h('div', { className: 'dsh-ma-alert' },
          h('strong', null, t('errorTitle')),
          h('p', null, error),
          h('button', { type: 'button', className: 'dsh-ma-button', onClick: () => { void reload() } }, t('retry')),
        ) : null,
        state === null && loading ? h('div', { className: 'dsh-ma-card dsh-ma-hint' }, t('statusLoading')) : null,
        codeBlock,
        h('div', { className: 'dsh-ma-card' },
          h('h2', null, t('stepsTitle')),
          h('ol', { className: 'dsh-ma-steps' },
            h('li', null, t('step1')),
            h('li', null, t('step2')),
            h('li', null, t('step3')),
          ),
        ),
        h('div', { className: 'dsh-ma-card' },
          h('h2', null, t('diagnosticsTitle')),
          h('dl', { className: 'dsh-ma-meta' },
            h('div', null, h('dt', null, t('bindLabel')), h('dd', null, state === null ? t('unknown') : `${state.bindHost}:${state.port}`)),
            h('div', null, h('dt', null, t('gatewayLabel')), h('dd', null, state === null ? t('unknown') : state.gateway.running ? (state.gateway.publicOrigin ?? t('gatewayOn')) : t('gatewayOff'))),
            h('div', null, h('dt', null, t('deviceLabel')), h('dd', null, isIOS ? t('deviceIOS') : t('deviceOther'))),
            h('div', null, h('dt', null, t('launchMode')), h('dd', null, standalone ? t('standaloneYes') : t('standaloneNo'))),
            h('div', null, h('dt', null, t('secureYes')), h('dd', null, window.isSecureContext ? t('secureYes') : t('secureNo'))),
          ),
        ),
        h('div', { className: 'dsh-ma-card' },
          h('div', { className: 'dsh-ma-row' },
            h('div', null, h('h2', null, t('selftestTitle')), h('p', { className: 'dsh-ma-hint' }, t('selftestNote'))),
            h('button', { type: 'button', className: 'dsh-ma-button', onClick: () => { void selfTest() }, disabled: testing }, testing ? t('selftestRunning') : t('selftestRun')),
          ),
          checks === null ? null : h('ul', { className: 'dsh-ma-checks' },
            ...checks.map((check, index) => h('li', { key: index, className: `is-${check.status}` },
              h('span', { className: 'dsh-ma-dot' }),
              h('span', { className: 'dsh-ma-check-label' }, labels[check.label] ?? check.label),
              h('span', { className: 'dsh-ma-check-status' }, statusText[check.status]),
              h('span', { className: 'dsh-ma-check-detail' }, check.detail),
            )),
          ),
        ),
        h('div', { className: 'dsh-ma-card dsh-ma-note' },
          h('h2', null, t('httpTitle')),
          h('p', null, t('httpBody')),
          h('h2', null, t('zeroImpactTitle')),
          h('p', null, t('zeroImpactBody')),
        ),
        h('details', { className: 'dsh-ma-card dsh-ma-details' },
          h('summary', null, t('limitsTitle')),
          h('ul', null, h('li', null, t('limit1')), h('li', null, t('limit2')), h('li', null, t('limit3'))),
        ),
        h('p', { className: 'dsh-ma-toast', 'aria-live': 'polite' }, toast ?? ''),
      ),
    )
  }
}

declare const __PANEL_CSS__: string
const STYLES = __PANEL_CSS__

function factory(require: (id: string) => unknown): ClientModule {
  React = require('react') as ReactRuntime
  return {
    inject: ['slots', 'locale'],
    apply(ctx: ClientContext): void {
      ctx.effect(() => {
        const cleanups: Array<() => void> = []
        let translate: (key: string, params?: Record<string, unknown>) => string = (key) => ZH[key] ?? key
        try {
          if (ctx.locale !== undefined) {
            cleanups.push(ctx.locale.register(NS, { zh: ZH, en: EN }))
            translate = ctx.locale.bind(NS)
          }
        } catch (error) {
          ctx.logger?.error?.(`[mobile-access] locale registration failed: ${String(error)}`)
        }
        const t = (key: string): string => translate(key)
        const Panel = createPanel(t, ctx.locale)

        const safe = (label: string, register: () => () => void): void => {
          try {
            cleanups.push(register())
          } catch (error) {
            ctx.logger?.error?.(`[mobile-access] ${label} registration failed: ${String(error)}`)
          }
        }
        safe('main panel', () => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, Panel)))
        safe('sidebar entry', () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 15,
          locale: NS,
          label: () => t('panel'),
        }, PhoneIcon)))
        try {
          cleanups.push(installClipboardFallback())
        } catch (error) {
          ctx.logger?.warn?.(`[mobile-access] clipboard fallback unavailable: ${String(error)}`)
        }
        try {
          cleanups.push(installIOSReturnNewline())
        } catch (error) {
          ctx.logger?.warn?.(`[mobile-access] iOS Return newline unavailable: ${String(error)}`)
        }
        try {
          cleanups.push(installIOSInputZoomGuard())
        } catch (error) {
          ctx.logger?.warn?.(`[mobile-access] iOS input zoom guard unavailable: ${String(error)}`)
        }
        try {
          cleanups.push(installIOSModelKeyboardGuard())
        } catch (error) {
          ctx.logger?.warn?.(`[mobile-access] iOS model keyboard guard unavailable: ${String(error)}`)
        }
        try {
          cleanups.push(installIOSSidebarTapGuard())
        } catch (error) {
          ctx.logger?.warn?.(`[mobile-access] iOS sidebar tap guard unavailable: ${String(error)}`)
        }
        return () => {
          for (const cleanup of cleanups.reverse()) {
            try {
              cleanup()
            } catch {
              // Plugin cleanup must never break the host UI.
            }
          }
        }
      }, 'mobile-access client')
    },
  }
}

function PhoneIcon(props: { readonly size?: number; readonly active?: boolean }): unknown {
  const size = props.size ?? 24
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  },
    h('rect', { x: 6.2, y: 2.4, width: 11.6, height: 19.2, rx: 2.8 }),
    h('path', { d: 'M10 5.2h4' }),
    h('path', { d: 'M9.6 18.8h4.8' }),
    props.active === true ? h('path', { d: 'M9.5 10.2c1.4-1.4 3.6-1.4 5 0M10.8 12.4c.8-.8 1.8-.8 2.4 0' }) : null,
  )
}

const loader = (window as unknown as { __ModuleLoader__?: { load(definition: { id: string; factory: (require: (id: string) => unknown) => ClientModule }): void } }).__ModuleLoader__
if (loader === undefined) {
  console.error('[mobile-access] window.__ModuleLoader__ is unavailable; the client half was not loaded.')
} else {
  loader.load({ id: 'dsh-mobile-access', factory })
}

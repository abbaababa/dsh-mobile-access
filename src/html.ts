/** Self-contained, dependency-free HTML for the public pairing route. */

export interface PairingPageOptions {
  readonly error?: string | undefined
  readonly host: string
  readonly expiresAt: string
  readonly expired: boolean
  readonly locked: boolean
  readonly codeLength: number
  readonly codeTtlMs: number
  readonly nonce: string
}

export interface MessagePageOptions {
  readonly title: string
  readonly message: string
  readonly detail?: string | undefined
}

const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ')

export function contentSecurityPolicy(): string {
  return CSP
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f4f6fa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0f14" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DSH 手机访问">
<title>${escapeHtml(title)}</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #f4f6fa;
  --card: #ffffff;
  --text: #111827;
  --muted: #5f6b7a;
  --line: #dfe4ec;
  --brand: #2f5bea;
  --brand-ink: #ffffff;
  --danger: #b42318;
  --danger-bg: #fff2f0;
  --ok: #087443;
  --ok-bg: #eaf8f0;
  --shadow: 0 18px 50px rgba(20, 33, 61, .12);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f14;
    --card: #141b24;
    --text: #f3f6fa;
    --muted: #a5b2c2;
    --line: #2a3542;
    --brand: #7aa2ff;
    --brand-ink: #08101f;
    --danger: #ff9a90;
    --danger-bg: #2a1514;
    --ok: #69d9a3;
    --ok-bg: #10251b;
    --shadow: 0 18px 50px rgba(0, 0, 0, .35);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  background: radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 42%), var(--bg);
  color: var(--text);
  font: 16px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  -webkit-text-size-adjust: 100%;
}
.card {
  width: 100%;
  max-width: 430px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--card);
  box-shadow: var(--shadow);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--brand);
  color: var(--brand-ink);
  font-size: 15px;
  font-weight: 800;
}
h1 { margin: 0 0 8px; font-size: 25px; line-height: 1.2; letter-spacing: -.02em; }
p { margin: 0 0 14px; color: var(--muted); }
.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 5px 11px;
  margin: 2px 0 18px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.dot.ok { background: var(--ok); }
.dot.warn { background: #d97706; }
.dot.bad { background: var(--danger); }
.error, .locked {
  padding: 12px 13px;
  margin: 0 0 16px;
  border-radius: 12px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 14px;
  font-weight: 600;
}
label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; }
input {
  width: 100%;
  min-height: 54px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--bg);
  color: var(--text);
  font: 600 20px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: .18em;
  text-align: center;
  outline: none;
  -webkit-appearance: none;
}
input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 24%, transparent); }
button, .button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  margin-top: 12px;
  padding: 12px 16px;
  border: 0;
  border-radius: 13px;
  background: var(--brand);
  color: var(--brand-ink);
  font: 700 17px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
button:active, .button:active { transform: translateY(1px); }
.button.secondary {
  margin-top: 10px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}
.steps {
  margin: 20px 0 0;
  padding: 16px 0 0;
  border-top: 1px solid var(--line);
  counter-reset: step;
  list-style: none;
}
.steps li {
  position: relative;
  margin: 0 0 11px;
  padding-left: 30px;
  color: var(--muted);
  font-size: 14px;
}
.steps li:last-child { margin-bottom: 0; }
.steps li::before {
  counter-increment: step;
  content: counter(step);
  position: absolute;
  top: -1px;
  left: 0;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--brand) 14%, transparent);
  color: var(--brand);
  font-size: 12px;
  font-weight: 800;
}
.meta {
  margin-top: 16px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}
.meta code { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
@media (max-width: 360px) {
  .card { padding: 20px; border-radius: 18px; }
  h1 { font-size: 23px; }
}
</style>
</head>
<body>
<main class="card" role="main">
${body}
</main>
</body>
</html>`
}

export function renderPairingPage(options: PairingPageOptions): string {
  const status = options.locked
    ? { text: '配对码已锁定', dot: 'bad' }
    : options.expired
      ? { text: '配对码已过期', dot: 'warn' }
      : { text: '等待配对', dot: 'ok' }

  const error = options.error === undefined
    ? ''
    : `<div class="error" role="alert" aria-live="polite">${escapeHtml(options.error)}</div>`

  const form = options.locked || options.expired
    ? `<p class="locked">${options.locked
      ? '请回到 Mac 的 DSH，打开左侧栏「手机访问」，点击「刷新配对码」，然后重新加载本页。'
      : '配对码只在 10 分钟内有效。请回到 Mac 的 DSH 面板刷新配对码，然后重新加载本页。'}</p>
      <a class="button" href="/m">重新加载配对页</a>`
    : `<form method="post" action="/m" accept-charset="utf-8" novalidate>
        <input type="hidden" name="nonce" value="${escapeHtml(options.nonce)}">
        <label for="pairing-code">配对码</label>
        <input id="pairing-code" name="code" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="12" pattern="[0-9 ]*" placeholder="1234 5678" aria-describedby="pairing-help" required>
        <button type="submit">连接 DSH</button>
      </form>
      <p class="meta" id="pairing-help">配对码显示在 Mac 的 DSH 左侧栏「手机访问」面板中，共 ${options.codeLength} 位数字。输入错误次数过多会锁定，需在 Mac 面板刷新。</p>`

  return shell(`DSH 手机访问 · ${status.text}`, `
<div class="brand"><span class="mark">D</span><span>DeepSeek Harness</span></div>
<h1>手机访问</h1>
<p>在同一局域网内，用这台 iPhone 或 iPad 安全打开 Mac 上的官方 DSH Web。</p>
<div class="status"><span class="dot ${status.dot}"></span>${status.text}</div>
${error}
${form}
<ol class="steps">
  <li>在 Mac 的 DSH 左侧栏点击「手机访问」。</li>
  <li>输入面板上显示的 ${options.codeLength} 位配对码。</li>
  <li>配对成功后会自动进入 DSH，可再「添加到主屏幕」。</li>
</ol>
<p class="meta">当前地址：<code>${escapeHtml(options.host)}</code><br>本页面不会把配对码写入 URL 或浏览器历史记录。配对码有效至 ${escapeHtml(new Date(options.expiresAt).toLocaleTimeString('zh-CN', { hour12: false }))}（Mac 本地时间）。</p>
`)
}

export function renderMessagePage(options: MessagePageOptions): string {
  return shell(options.title, `
<div class="brand"><span class="mark">D</span><span>DeepSeek Harness</span></div>
<h1>${escapeHtml(options.title)}</h1>
<div class="error" role="alert">${escapeHtml(options.message)}</div>
${options.detail === undefined ? '' : `<p class="meta">${escapeHtml(options.detail)}</p>`}
<a class="button secondary" href="/m">返回配对页</a>
`)
}

# DSH Mobile Access (`dsh-mobile-access`)

**Open the official DeepSeek Harness (DSH) Web app on your Mac or Windows 10/11
PC from Safari on your iPhone or iPad. No phone app. No changes to DSH itself.
Your desktop setup keeps working exactly as it did before.**

[中文说明](README.md) · [GitHub](https://github.com/abbaababa/dsh-mobile-access) · [npm](https://www.npmjs.com/package/dsh-mobile-access) · [Issues](https://github.com/abbaababa/dsh-mobile-access/issues)

---

## The short version

DSH normally opens a Web page on your computer. That page is protected by a
long login link that DSH prints in the terminal. The link is too long to type
on a phone.

This plugin adds a simple, temporary “door code” for your phone:

1. The DSH sidebar shows an **8-digit code** on your computer.
2. You open a short address on your iPhone, such as `http://192.168.1.23:3081/m`.
3. You type the 8 digits.
4. Safari logs in and keeps a secure cookie for **30 days**.

That is the whole idea. You do **not** need to copy the long token, install an
app, jailbreak the phone, or expose DSH to the public internet.

### A plain-English analogy

- DSH is a locked house.
- The long login link is a very long key. A phone cannot type it.
- This plugin puts a temporary door keypad next to the door.
- Your computer shows the 8-digit door code.
- After the correct code, Safari gets a wristband (a cookie) that works for 30 days.
- The long key never appears in the phone’s address bar, history, or web requests.

---

## Is it safe? Does it steal files?

**Short answer: the 1.1.8 source and npm package show no file theft, data upload, or remote-control behavior.**

- **No production dependencies.** The package contains only the runtime JS, config, icon, and docs.
- **No dangerous capabilities.** The host uses only Node’s built-in `http`, `net`, `os`, and Web Crypto. It does not import `fs` to read files, `child_process` to run commands, or `eval`.
- **No third-party server.** Pairing, pages, and WebSockets stay on your LAN or your own Tailscale network. The code and cookie go only to this DSH instance.
- **No content collection.** The plugin does not read chats or scan files. The LAN gateway only forwards HTTP/WebSocket requests you make, like a small local router; it does not store a copy.
- **Checks:** `npm audit --omit=dev` reports **0 vulnerabilities**; npm verifies the 1.1.8 registry signature; 33 tests and Ubuntu/Windows CI pass.
- **Limits:** a DSH plugin runs with the DSH process’s permissions. Install the exact npm version, keep the 8-digit code private, and on public Wi-Fi prefer Tailscale or turn the gateway off. Any software has supply-chain risk; pinning `1.1.8` is safer than `@latest`.

You can verify it yourself:

```bash
cd /path/to/dsh-mobile-access
npm view dsh-mobile-access@1.1.8 dependencies
npm audit --omit=dev
npm audit signatures
grep -RInE "child_process|exec\\(|eval\\(|https?://" src
```

---

## What you get

- A **Mobile Access** entry in the DSH left sidebar (Chinese UI: “手机访问”).
- A short address and an 8-digit pairing code for your phone.
- A full DSH Web session in iPhone/iPad Safari, including sending messages,
  switching sessions, changing models, settings, and the right-side panel.
- Small **iPhone/iPad-only** fixes:
  - Return inserts a newline; the send button sends.
  - Tapping the model switcher does not zoom the page or pop up the keyboard.
  - One tap switches a sidebar session and collapses the sidebar.
  - Swipe right to open the sidebar; tap the conversation content to close it.
  - Switching sessions dismisses the keyboard instead of reopening it.
- A local-network gateway when DSH listens only on `127.0.0.1`.
- Optional support for Tailscale Serve when you need access from outside your home.

Mac and Windows desktop use the same package. The iPhone-only fixes are not
installed on Mac or Windows, so desktop behavior is unchanged.

---

## What you need

1. A Mac, or a Windows 10/11 PC.
2. DSH Web already running and working on that computer.
3. An iPhone or iPad with Safari.
4. The phone and the computer on the **same Wi-Fi / local network**
   (unless you set up the optional Tailscale path).
5. Node.js and the `dsh` command already available on the computer
   (if DSH starts, they are already there).

You do **not** need:

- iTunes;
- an Apple Developer account;
- a paid server;
- a public IP address;
- any change to DSH source code.

---

## Install in one command

### Mac

Open **Terminal** (`Command + Space`, type `Terminal`, press Return), paste this
one line, and press Return:

```bash
dsh plugin --profile web add dsh-mobile-access@1.1.8 --registry=https://registry.npmjs.org/
```

### Windows 10/11

Open **Windows PowerShell** (`Win + X`, then choose Terminal or Windows
PowerShell — **no administrator mode needed**), paste the same line, and press
Enter:

```powershell
dsh plugin --profile web add dsh-mobile-access@1.1.8 --registry=https://registry.npmjs.org/
```

What the command does:

1. Downloads the plugin from npm.
2. Installs it into the DSH profile named `web`.
3. Adds the plugin to that profile’s bundle list automatically.

If your DSH profile is not named `web`, replace `web` with your profile name.
If you are not sure, keep `web`; it is the common default for this setup.

After installing, refresh the DSH page once
(`Command + R` on Mac, `Ctrl + R` on Windows). If the **Mobile Access** item
still does not appear, close and reopen the DSH page, or use the DSH plugin
manager to check whether it asks for a restart.

> The `--registry=https://registry.npmjs.org/` part avoids a common problem:
> some npm mirrors take hours to receive a new version. It does not change
> where the package comes from permanently.

---

## Pair your phone

### On the computer

1. Open DSH Web in your desktop browser.
2. Click **Mobile Access** in the left sidebar (Chinese UI: “手机访问”).
3. The panel shows:
   - a short address (the exact address to use on the phone);
   - an 8-digit code;
   - a countdown before the code expires.

If the code expired, click **Refresh pairing code** (Chinese UI: “刷新配对码”).

### On the iPhone

1. Make sure the iPhone is on the same Wi-Fi as the computer.
2. Open Safari and go to the short address shown in the panel.
   It ends with `/m`. For example:
   - `http://192.168.1.23:3080/m` when DSH is bound to the LAN address;
   - `http://192.168.1.23:3081/m` when DSH only listens on `127.0.0.1`
     and the plugin’s gateway is active.
3. Type the 8 digits and tap **Connect DSH** (Chinese UI: “连接 DSH”).
4. You should land in the full DSH Web app.

The pairing code is valid for **10 minutes**. After a successful pairing, Safari
keeps a login cookie for **30 days**. When it expires, repeat the same pairing
steps; you do not need to reinstall the plugin.

If Safari already has a valid DSH login cookie, opening `/m` may take you
straight into DSH instead of showing the code form. That is normal.

---

## If DSH only listens on `127.0.0.1`

`127.0.0.1` means “this computer only.” A phone cannot reach it, because on the
phone `127.0.0.1` means the phone itself.

Starting with version **1.1.0**, this plugin detects that case and starts a
small **local-network gateway** on port `3081`:

- DSH itself can keep using `http://127.0.0.1:3080`;
- the computer’s normal DSH use does not change;
- the phone uses `http://<computer-LAN-IP>:3081/m`;
- the panel shows the exact address and whether the gateway is running.

The gateway only forwards traffic to the local DSH. It is not a public tunnel.
If port `3081` is busy, the plugin tries nearby ports; always use the address
shown in the panel.

On Windows, allow **Node.js** on **Private networks** when the firewall asks.
If the Wi-Fi network is marked “Public,” Windows may block the phone. Change the
network profile to **Private**, or allow Node.js on the current network.

---

## Everyday use on the iPhone

- **Send a message:** type, then tap the send button. The Return key adds a
  new line; it does not send.
- **Switch sessions:** tap a session once. The sidebar collapses automatically.
- **Open the sidebar:** swipe right in the conversation area, or use the normal
  sidebar control.
- **Close the sidebar:** tap the conversation content once (not a button, link,
  input, code block, session row, or menu).
- **Change models:** tap the model switcher. The page should not zoom, and the
  keyboard should not jump up. Tap the search field only if you want to search.
- **Keyboard after switching:** after you switch sessions, the keyboard closes
  and stays closed until you deliberately tap the input box.

The iPhone-only fixes are intentionally conservative. They do not change Mac or
Windows desktop keyboard, mouse, layout, or focus behavior.

---

## Optional: access from outside your home with Tailscale Serve

> This is optional. If you only use DSH at home on the same Wi-Fi, skip this
> section. This plugin is **not** a VPN and does **not** expose DSH to the
> public internet by itself.

[Tailscale](https://tailscale.com/) can give your devices a private network.
One safe pattern is **Tailscale Serve**:

1. Install Tailscale on the Mac and sign in with the same tailnet on the iPhone.
2. Start DSH on the computer. For the loopback gateway, keep DSH on
   `127.0.0.1:3080`.
3. Run:

   ```bash
   tailscale serve --bg 3080
   ```

4. Start DSH with the tailnet hostname trusted. Example:

   ```bash
   dsh --profile web --host 127.0.0.1 --port 3080 \
     --trusted-host your-mac.your-tailnet.ts.net --no-open
   ```

5. On the iPhone, open:

   ```text
   https://your-mac.your-tailnet.ts.net/m
   ```

6. Enter the pairing code as usual.

Important:

- Use **Serve**, not **Funnel**. Serve stays inside your tailnet; Funnel publishes
  to the internet.
- The `--trusted-host` value must match the browser address exactly.
- If the page says **“Request rejected / Host check failed”**, the hostname in
  the address and the hostname trusted by DSH do not match. Fix the
  `--trusted-host` value and restart DSH.

This path is more advanced than same-Wi-Fi use. If it does not work, use the
normal local-network address first to confirm the plugin itself is healthy.

---

## Windows 10/11 notes

- Use native Windows 10/11 for the DSH host. WSL networking is separate from
  Windows networking and can make the phone-to-PC connection confusing.
- Open PowerShell with `Win + X`; administrator mode is not required.
- When Windows Firewall asks, allow Node.js on **Private networks**.
- If the phone cannot connect, run `ipconfig` in PowerShell and use the
  computer’s IPv4 address, for example `192.168.1.23`.
- The same npm package and the same sidebar panel are used on Mac and Windows.
- Automated build and test checks run on Windows in GitHub Actions. Real home
  networks vary, so use the troubleshooting list below if your router isolates
  clients or blocks the port.

---

## Troubleshooting

| What you see | What to try |
| --- | --- |
| `/m` will not open or shows 401 | Check that the phone and computer are on the same Wi-Fi. Use the exact address shown in the panel. If DSH is loopback-only, use the `:3081` gateway address, not `:3080`. |
| “Mobile Access” is missing from the sidebar | Refresh the DSH page. Check that the install command finished without errors. If DSH asks for a restart, restart it yourself and reopen the page. |
| “Request rejected / Host check failed” | The address host does not match the host DSH trusts. Use the exact address from the panel. For Tailscale, make `--trusted-host` match the `.ts.net` name exactly. |
| Code is “locked” | For safety, a code locks after too many wrong attempts. On the computer panel, click **Refresh pairing code**, then try the new code. |
| Code expired | Codes last 10 minutes. Click **Refresh pairing code** and enter the new one. |
| Return still sends instead of adding a new line | Make sure version `1.0.2` or newer is installed, then fully close and reopen the Safari tab so the new client file loads. |
| Copy button does nothing | On plain HTTP, iOS may limit clipboard access. Long-press and copy manually. The plugin already adds an iOS fallback where possible. |
| One tap still does not switch sessions | Fully close the Safari tab and reopen it. Then tap the session title once, not the row’s “…” menu. |
| Keyboard still pops up after switching | Fully close and reopen the Safari tab after updating to `1.1.8`. If it still happens, note whether the keyboard was already open before the switch and report it in an issue. |
| Phone cannot connect on Windows | Allow Node.js on Private networks in Windows Firewall. Change the Wi-Fi profile to Private. Check `ipconfig` for the correct IPv4 address. |
| Phone cannot connect on any system | Check the router’s “client isolation / AP isolation” setting. Guest Wi-Fi often blocks device-to-device traffic. |

---

## Is it safe?

The pairing code is a short-lived secret, not a replacement for your DSH password.

- 8 digits, generated with the operating system’s secure random generator.
- Expires after **10 minutes** by default.
- A single IP is locked after **5 wrong attempts**.
- The whole pairing flow is locked after **20 wrong attempts**.
- A single IP is limited to **10 attempts per minute**.
- The pairing form uses a one-time nonce cookie and a Host check.
- The login cookie is `HttpOnly`, so page scripts cannot read it.
- The launch token never appears in the phone’s address bar, history, or
  `Referer` header.
- The code and failure counters live in memory; the plugin does not write them
  to disk or logs.

Do:

- use it on a trusted home or office network;
- keep the pairing code private;
- remove the plugin if you no longer need it.

Do not:

- post the pairing code in a public chat;
- map the DSH port directly to the public internet;
- treat this plugin as a VPN, a public tunnel, or a replacement for Tailscale’s
  access controls.

---

## What this plugin does not do

- It does not expose DSH to the public internet.
- It does not replace a VPN or a reverse proxy.
- It does not add iOS-only patches to Android, Mac, or Windows browsers.
- It does not make desktop-only interactions (for example, drag and drop) work
  on an iPhone.
- It does not override iOS background limits. Keep the DSH tab in the foreground
  for long-running work.
- It does not change DSH’s own authentication, source code, or desktop layout.

---

## Uninstall

```bash
dsh plugin --profile web remove dsh-mobile-access
```

After removal:

- the **Mobile Access** sidebar entry disappears;
- `/m` returns to the normal DSH fallback (no longer a pairing page);
- `/api/mobile-access/*` routes are gone;
- the iOS clipboard, Return, zoom, keyboard, and sidebar touch guards are
  removed.

A login cookie already issued by DSH may remain in Safari until it expires. That
is DSH’s normal authentication behavior, not a credential written by this plugin.

---

## How it is tested

- **33 automated tests** cover the pairing service, HTTP routes, static bundle
  contract, gateway, and client behavior.
- GitHub Actions runs the build and tests on **Ubuntu** and **Windows**.
- The live installation path is also tested with the official
  `dsh plugin --profile web add ...` command.

CI badge and workflow:
[verify.yml](https://github.com/abbaababa/dsh-mobile-access/actions/workflows/verify.yml)

---

## Version

Current version: **1.1.8**.

Recent highlights:

- `1.1.8` — switching sidebar sessions no longer pops up the iPhone keyboard.
- `1.1.7` — right swipe opens the sidebar; tap the conversation content to close it.
- `1.1.6` — sidebar swipe gestures.
- `1.1.5` — Tailscale Serve Host support.
- `1.1.4` — one-tap session switching with automatic sidebar collapse.
- `1.1.2` — model switcher no longer auto-opens the keyboard.
- `1.1.1` — model switcher no longer zooms the page.
- `1.1.0` — local gateway for loopback-only DSH.
- `1.0.2` / `1.0.3` — iPhone Return inserts a newline.
- `1.0.0` / `1.0.1` — first production release and npm publishing.

---

## License

MIT. See [LICENSE](LICENSE).

If something is unclear, open an issue and include:

- your computer OS (macOS 27, Windows 10, or Windows 11);
- your iPhone/iPad model and iOS version;
- the exact address shown in the panel;
- what you tapped and what happened (a screenshot is helpful, but cover the
  pairing code).

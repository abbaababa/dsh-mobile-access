# 手机访问（dsh-mobile-access）

> 用 iPhone / iPad 自带的 Safari，安全打开 Mac 上的 DeepSeek Harness Web。
>
> **不用装 App，不用改 DSH 源码，不影响 Mac 上原来怎么用。**

这是一个独立的 TypeScript DSH 插件（bundle）。它只在 DSH 里增加三样东西：

1. 左侧栏一个「手机访问」入口；
2. 一个给手机用的短地址和 8 位配对码；
3. 一个只在 iPhone/iPad 上生效的「回车换行」小补丁。

其他东西都不动：不改 DSH 核心、不改登录方式、不替换页面、不装后台服务、不拦截现有请求。

---

## 先看结论：它到底帮你做了什么

假设你的 Mac 上正在运行 DSH Web，地址是：

```text
http://192.168.1.23:3080
```

以前 iPhone 直接打开这个地址，会看到：

```text
dsh web authentication required; reopen the URL printed by dsh web.
```

这不是网络坏了，而是 DSH 的安全保护：它只认 Mac 终端里打印出来的那条**带很长 token 的登录链接**。这条链接太长，手机不可能手输。

这个插件做的事，就是把这个过程变成：

```text
Mac 面板显示 8 位配对码
        ↓
iPhone 打开短地址 /m
        ↓
输入 8 位数字
        ↓
自动登录，进入完整 DSH Web
```

用生活里的话说：

- DSH 是一栋上锁的房子；
- 原来的长 token 是一把很长的钥匙，手机没法输；
- 插件在门口装了一个「临时门禁」；
- Mac 上的人看到 8 位门禁码，告诉手机；
- 手机输对后，屋里直接给它戴上 30 天有效的「手环」（HttpOnly 登录 Cookie）。

**长钥匙不会出现在手机地址栏、浏览器历史或网页来源信息里。**

---

## 适合谁

- Mac 和 iPhone / iPad 在**同一个 Wi-Fi / 局域网**；
- Mac 上运行的是官方 DeepSeek Harness Web；
- 希望手机用 Safari 完整使用 DSH，而不是只看一个 401 错误页。

## 不适合谁

- 想在**外网**（不在同一个 Wi-Fi）访问家里的 Mac：这不是 VPN / 内网穿透工具，请不要把 DSH 直接暴露到公网。
- Mac 的 DSH 只监听 `127.0.0.1`：手机根本连不到，需要先把监听地址改为 Mac 的局域网 IP。
- 使用 HTTPS 但证书不被 iPhone 信任：Safari 会先拦截证书，这和插件无关。

---

## 安装（Mac 上操作，复制即可）

### 第 1 步：确认 Mac 和 iPhone 连的是同一个 Wi-Fi

iPhone 打开「设置 → 无线局域网」，确认和 Mac 连的是同一个网络。

### 第 2 步：在 Mac 终端执行一条命令

```bash
dsh plugin --profile web add dsh-mobile-access@1.0.3 --registry=https://registry.npmjs.org/
```

这条命令做三件事：

1. 从 npm 下载插件；
2. 装进当前 DSH 的 `web` profile；
3. 自动把它加入 DSH 的插件列表。

> `--profile web` 里的 `web` 是本项目使用的 profile 名称。  
> 如果你的 DSH 用的是其他 profile，把 `web` 换成实际名称即可。  
> 不确定时，照抄这条命令；如果提示 profile 不存在，再检查你平时启动 DSH 用的名称。

### 第 3 步：刷新 DSH 页面

在 Mac 的 DSH 页面按：

```text
Command + R
```

刷新后，左侧栏应该出现一个**手机图标**，名字叫「手机访问」。

正常情况下**不需要重启**。  
如果插件管理器明确提示“需要重启”，请手动重启 DSH；不要在不清楚状态时反复重装。

### 可选：确认装好了

```bash
dsh plugin --profile web why dsh-mobile-access
```

能看到 `dsh-mobile-access` 就说明依赖已经装上。

---

## 配对（Mac + iPhone 一起操作）

### Mac 端

1. 打开 DSH Web；
2. 点左侧栏的「手机访问」；
3. 面板会显示：
   - 配对地址，例如 `http://192.168.1.23:3080/m`
   - 8 位配对码，例如 `1234 5678`
   - 剩余有效时间
   - 「复制链接」「复制配对码」「刷新配对码」

### iPhone 端

1. 打开 Safari；
2. 输入 Mac 面板上显示的 `/m` 地址（不要输成 `127.0.0.1`，也不要用 `localhost`）；
3. 输入 8 位配对码；
4. 点「连接 DSH」；
5. 成功后会直接进入完整 DSH Web。

建议再做一个动作：

```text
Safari 分享按钮 → 添加到主屏幕
```

以后从主屏幕图标进入，体验更接近 App。

---

## 日常使用

### iPhone 上怎么发消息

- 在输入框里按 iPhone 自带键盘的 **Return**：**换行**，不会直接发送；
- 要发送时，点输入框右侧的**发送按钮**；
- 这样可以正常输入多行提示词。

### Mac 上有没有变化

没有。

- Mac 上仍然是：**Enter 发送，Shift+Enter 换行**；
- 插件只在 iPhone / iPad 上安装「Return 换行」监听，Mac 和非 Apple 平台不会安装；
- 左边栏只多一个「手机访问」入口，其他入口和面板保持原样。

### 配对码过期了怎么办

配对码默认 **10 分钟**有效。过期后：

1. 回到 Mac 的「手机访问」面板；
2. 点「刷新配对码」；
3. iPhone 重新打开 `/m`，输入新码。

### 登录过期了怎么办

配对成功后会签发一个默认 **30 天**有效的 HttpOnly Cookie。  
如果过期，重新走一次 `/m` 配对即可，不需要重装插件。

---

## 安全吗

这个插件把安全边界做在“局域网 + 短时配对码”上：

- 8 位数字配对码，使用系统安全随机数生成；
- 默认 10 分钟过期；
- 单个 IP 连续失败 5 次锁定；
- 全局失败 20 次锁定；
- 单个 IP 每分钟最多尝试 10 次；
- 配对页每次刷新都会换一个一次性 nonce，并校验 Host；
- 配对码和失败次数只放在内存里，不写磁盘、不写日志；
- 登录 Cookie 是 HttpOnly，手机网页脚本读不到；
- 启动 token **不会**出现在手机的地址栏、历史记录或 Referer 里。

需要注意：

- 配对码就相当于临时门禁码，**不要截图发到公开群**；
- 它只适合可信的局域网；
- 不要把 DSH 的端口直接映射到公网。

更完整的安全说明见 [`docs/security.md`](docs/security.md)。

---

## 常见问题（小白版）

### 1. 打开 `/m` 还是 401 或打不开

按顺序检查：

1. iPhone 和 Mac 是不是同一个 Wi-Fi；
2. 地址是不是 Mac 的**局域网 IP**，而不是 `127.0.0.1`；
3. DSH 是否只监听了回环地址；
4. 路由器是否开启了「客户端隔离 / AP 隔离」（开启后同一 Wi-Fi 的设备也不能互访）。

### 2. 左边栏没有「手机访问」

- 先刷新 DSH 页面（`Command + R`）；
- 再确认安装命令没有报错；
- 检查 `dsh plugin --profile web why dsh-mobile-access`；
- 如果刚安装完仍没有，按插件管理器提示判断是否需要手动重启 DSH。

### 3. 输入配对码后提示「已锁定」

这是安全设计，不会自动解锁。  
在 Mac 面板点「刷新配对码」，然后用新码重试。

### 4. 提示「请求未通过 Host 或来源校验」

- 确认你访问的是 Mac 面板上显示的完整地址（包括 `:3080`）；
- 不要用另一个域名 / IP 混着访问；
- 升级到 `1.0.0` 及以上版本。`1.0.0` 已修复早期 iOS Safari 表单提交被误判的问题。

### 5. iPhone 按 Return 还是直接发送

- 确认版本是 `1.0.3` 或更高；
- 安装/升级后刷新一次页面，让新的 `client.js` 生效；
- 如果仍然直接发送，请记录 iPhone 型号、iOS 版本和页面地址，提交 issue。

### 6. 复制按钮没反应

- 插件在 iOS 的普通 HTTP 页面上提供剪贴板回退；
- 如果仍然失败，长按文字手动复制；
- Mac 不受这个回退影响。

### 7. 安卓 / Windows 浏览器能用吗

- 配对页对现代浏览器通用；
- 左侧栏面板在所有 DSH Web 客户端显示；
- 剪贴板和 Return 换行的全局回退只在 iOS / iPadOS 上安装。

---

## 它是怎么工作的（技术小白可跳过）

```text
┌─────────────────────────────┐
│ Mac 上的 DSH Web             │
│                             │
│  host 插件                   │
│   ├─ GET  /m                │  配对页：短地址 + 8 位码
│   ├─ POST /m                │  校验 nonce/码，签发 Cookie
│   ├─ GET  /api/.../state    │  仅 Mac 面板可读
│   └─ POST /api/.../rotate   │  仅 Mac 面板可刷新
│                             │
│  client 插件                 │
│   └─ 左侧栏「手机访问」       │
└─────────────────────────────┘
              │
              │ 同一局域网
              ▼
┌─────────────────────────────┐
│ iPhone Safari               │
│  打开 /m → 输入 8 位码       │
│  → 收到 HttpOnly Cookie     │
│  → 进入完整 DSH Web          │
└─────────────────────────────┘
```

技术边界：

- 三个路由都是 `kind: 'exact'`，没有前缀路由，没有 fallback 路由；
- 不接管 DSH 的 SPA index；
- 不注册 Service Worker；
- 不修改 DSH 核心源码、认证密钥或 profile 配置；
- 所有路由、slot、监听器都有清理路径；
- 插件注册失败只影响插件自身，不会替换 DSH 页面根节点。

### 认证细节

配对成功后，host 调用 DSH 自己的 `authenticatedUrl()` 取得启动 token，再在**服务端**用合成的 `GET /` 请求调用 `authorizeIndex()`，把返回的 303 和 `Set-Cookie` 重放给手机浏览器。  
浏览器只会看到 `Location: /`，不会看到 `?token=`。

这条路径避开了早期 iOS 27 Safari 表单 POST 被 Connection Host/Origin 校验误判为 403 的问题；`/m` 改用：

- Host 固定；
- 一次性 nonce；
- `Content-Type` 校验；
- 2048 字节请求体上限。

同时保留 DSH 自己的 v1 页面 Cookie 签发逻辑，不复制、不重写认证算法。

### iPhone Return 换行细节

官方输入框的规则是：

```text
Enter       → 发送
Shift+Enter → 换行
```

iPhone 软键盘没有可用的 Shift 键，因此插件在 **iOS / iPadOS** 上监听官方输入框的 `keydown`：

- 只处理带 `data-composer-input` 的输入框；
- 跳过 Shift/Alt/Ctrl/Meta、输入法组合、打开的菜单；
- 把普通 Return 当作 Shift+Enter 处理，让 Lexical 走浏览器原生换行；
- 如果浏览器不允许改写键盘事件，则回退到 `execCommand('insertLineBreak')`；
- Mac 和非 Apple 平台完全不安装这个监听。

---

## 安装方式汇总（给不同场景）

### 推荐：npm 官方命令

```bash
dsh plugin --profile web add dsh-mobile-access@1.0.3 --registry=https://registry.npmjs.org/
```

### 使用 `@latest`

```bash
dsh plugin --profile web add dsh-mobile-access@latest --registry=https://registry.npmjs.org/
```

说明：pnpm 的默认镜像可能比 npm 官方源晚同步。  
如果 `@latest` 装到旧版，请使用上面的精确版本，或加 `--registry=https://registry.npmjs.org/`。

### 从本机目录安装（开发 / 离线）

```bash
git clone <this-repository>
cd dsh-mobile-access
npm install
npm run verify
dsh plugin --profile web add /absolute/path/to/dsh-mobile-access
```

### 从 tarball 安装

```bash
npm pack
dsh plugin --profile web add /absolute/path/to/dsh-mobile-access-1.0.3.tgz
```

> GitHub 仓库是源码与文档的家；日常安装请优先用 npm 一条命令，不要求用户自己编译。

---

## 开发与验证（技术读者）

要求：

- Node.js >= 22
- npm
- 不需要 DSH 源码 checkout

```bash
git clone <this-repository>
cd dsh-mobile-access
npm install
npm run verify
```

`npm run verify` 会依次执行：

1. TypeScript 类型检查；
2. 构建 host / client 产物；
3. Node 语法检查；
4. 单元测试、路由测试、静态清单测试；
5. 占位符残留扫描；
6. `npm pack --dry-run` 检查发布内容。

单独命令：

```bash
npm run typecheck   # 只检查，不写文件
npm run build       # 构建根目录运行产物
npm test            # 构建 + 单元测试
```

TypeScript 编译器优先使用本目录的 `node_modules/.bin/tsc`；  
没有安装时，可用 `DSH_TSC` 指定：

```bash
DSH_TSC=/path/to/tsc npm run verify
```

CI 在 GitHub Actions 上使用 Node 22 执行同一套 `npm run verify`。

### 产物结构

```text
index.js        host 入口（ESM）
service.js      配对状态机
routes.js       /m、/api/mobile-access/state、/api/mobile-access/rotate
html.js         无依赖配对页
types.js        结构性类型（编译后为空导出）
client.js       浏览器端 bundle（单文件、无 import/export）
cordis.patch.yml
locale/*.json   meta 与 ui 文案
icon.svg
```

`client.js` 由 `scripts/build.mjs` 把 `client-runtime.js` 与 `client.js` 两段拼接，并注入 `locale/*.json` 的 `ui` 字典和 `src/panel.css`，没有运行时依赖。

---

## 平台限制（不是插件缺陷）

- iOS Safari 不支持桌面式拖放（Drag and Drop）；依赖该交互的桌面功能在 iPhone 上不可用。
- iOS 会在后台挂起页面；长任务请保持 DSH 页面在前台。
- Safari 的下载行为由 iOS 的「文件」App 接管，不能像 macOS 一样直接保存到任意目录。
- 局域网 HTTP 不是安全上下文；依赖 `crypto.subtle`、Service Worker、Web Push 等安全上下文 API 的功能不可用。DSH 已对 UUID 和剪贴板做了回退，本插件再补一层 iOS 剪贴板回退。
- 本插件不提供公网访问、内网穿透、VPN 或端口映射。

---

## 卸载

通过 DSH 插件管理器移除 `dsh-mobile-access`：

```bash
dsh plugin --profile web remove dsh-mobile-access
```

移除后：

- 左侧栏入口消失；
- `/m` 恢复为普通 SPA fallback（不再是配对页）；
- `/api/mobile-access/*` 不再注册；
- iOS 剪贴板回退和 Return 换行监听被清理。

已签发的登录 Cookie 可能仍留在浏览器中，直到过期；这是 DSH 认证层的行为，不是插件额外写入的凭证。

---

## 版本

- `1.0.0` — 首个工程化版本：配对页、owner-only 状态/刷新、左侧栏面板、零 Mac 影响边界、单元/路由/静态门禁。
- `1.0.1` — 安装文档与 npm 发布元数据。
- `1.0.2` — iPhone / iPad 自带键盘 Return 换行。
- `1.0.3` — Safari 不支持改写键盘事件时的换行回退；当前 npm `latest`。

## 许可证

[MIT](LICENSE)

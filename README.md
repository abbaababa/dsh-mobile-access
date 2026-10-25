# 手机访问（dsh-mobile-access）

[![verify](https://github.com/abbaababa/dsh-mobile-access/actions/workflows/verify.yml/badge.svg)](https://github.com/abbaababa/dsh-mobile-access/actions/workflows/verify.yml)

> 用 iPhone / iPad 自带的 Safari，安全打开 **Mac 或 Windows 10/11** 上的 DeepSeek Harness Web。
>
> **不用装 App，不用改 DSH 源码，不影响你原来在电脑上的使用。**
>
> **Windows 10/11 用户也能用**：同一份插件，不区分 Mac / Windows。
> Windows 只是多一个“防火墙允许 Node.js”的步骤；完整小白步骤见
> [Windows 10/11 快速上手](#windows-1011-快速上手小白版)。

这是一个独立的 TypeScript DSH 插件（bundle）。它主要在 DSH 里增加三样东西：

1. 左侧栏一个「手机访问」入口；
2. 一个给手机用的短地址和 8 位配对码；
3. 一组只在 iPhone/iPad 上生效的输入与触摸小补丁（Return 换行、防自动放大、侧栏手势等）。

其他东西都不动：不改 DSH 核心、不改登录方式、不替换页面、不装后台服务、不拦截现有请求。

---

## 先看结论：它到底帮你做了什么

假设你的电脑（Mac 或 Windows 10/11）上正在运行 DSH Web，地址是：

```text
http://192.168.1.23:3080
```

以前 iPhone 直接打开这个地址，会看到：

```text
dsh web authentication required; reopen the URL printed by dsh web.
```

这不是网络坏了，而是 DSH 的安全保护：它只认电脑终端（Mac 终端 / Windows PowerShell）里打印出来的那条**带很长 token 的登录链接**。这条链接太长，手机不可能手输。

这个插件做的事，就是把这个过程变成：

```text
电脑面板显示 8 位配对码
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
- 电脑前的人看到 8 位门禁码，告诉手机；
- 手机输对后，屋里直接给它戴上 30 天有效的「手环」（HttpOnly 登录 Cookie）。

**长钥匙不会出现在手机地址栏、浏览器历史或网页来源信息里。**

---

## Windows 10/11 快速上手（小白版）

> 这一段是专门写给“不写代码、不懂网络”的 Windows 用户的。
> 如果你用的是 Mac，可以直接看下面的[安装](#安装mac-或-windows-操作复制即可)。

### 先说结论

**这个插件不是 Mac 专用的。**

它在 Windows 10 / Windows 11 上使用的是**同一个 npm 包、同一条安装命令、同一个「手机访问」面板**。  
Windows 和 Mac 最需要额外注意的区别是：

> Windows 第一次运行时，系统防火墙会弹出一个“是否允许 Node.js 访问网络”的窗口，点一次“允许”即可。

不需要安装 iTunes，不需要买 Mac，不需要改 DSH 源码，也不需要在 iPhone 上装 App。

### 你需要准备什么

只需要 4 样东西：

1. 一台 **Windows 10 或 Windows 11** 电脑；
2. 电脑上的 **DSH Web 已经能正常打开**（平时启动 DSH 的那个窗口不要关）；
3. iPhone 和 Windows 电脑连的是**同一个 Wi-Fi**；
4. Windows 上已经装好 DSH 需要的 **Node.js**（DSH 能启动，就说明已经装好）。

### 三步安装

#### 第 1 步：打开 PowerShell

在 Windows 上：

1. 按键盘上的 **`Win + X`**；
2. 在弹出的菜单里选 **“终端”** 或 **“Windows PowerShell”**；
3. 不需要“以管理员身份运行”；
4. 看到类似 `PS C:\Users\你的名字>` 的提示符，就说明打开了。

#### 第 2 步：复制下面这一条命令，粘贴，回车

```powershell
dsh plugin --profile web add dsh-mobile-access@1.1.8 --registry=https://registry.npmjs.org/
```

这条命令只做三件事：

1. 从 npm 下载插件；
2. 装进 DSH 的 `web` profile；
3. 自动把插件加入 DSH 的插件列表。

> 如果你的 DSH 平时用的不是 `web` 这个 profile，把命令里的 `web` 换成你实际使用的名字。
> 不确定时先照抄；如果提示 profile 不存在，再检查你平时启动 DSH 用的名称。

如果 PowerShell 提示“`dsh` 不是内部或外部命令”，说明 DSH 没有加入系统 PATH。  
这不代表插件坏了：请先按你平时启动 DSH 的方式打开它的终端，再执行同一条命令；或者把 DSH 的 `bin` 目录加入 PATH。不要因此重装 Node.js 或 DSH。

#### 第 3 步：回到 DSH 页面，按 `Ctrl + R` 刷新

刷新后，DSH 左侧栏会出现一个**手机图标**，名字叫「手机访问」。

如果插件管理器提示“需要重启”，请**手动重启 DSH**；不要连续反复重装。  
正常情况下不需要重启。

### 第一次打开：Windows 防火墙会问你

第一次让手机访问时，Windows 可能弹出：

```text
Windows Defender 防火墙已阻止此应用的部分功能
是否允许 Node.js 在专用网络上通信？
```

请这样选：

1. 勾选 **“专用网络”**（英文是 **Private networks**）；
2. 点 **“允许访问”**（Allow access）。

不要勾“公用网络”（Public），除非你明确知道自己在做什么。

如果当时误点了“取消”，或者根本没弹窗，可以手动放行：

1. 打开 **Windows 安全中心**；
2. 点 **“防火墙和网络保护”**；
3. 点 **“允许应用通过防火墙”**；
4. 点 **“更改设置”**；
5. 在列表里找到 **Node.js**；
6. 勾选 **“专用”**；
7. 点“确定”。

还要确认当前 Wi-Fi 被 Windows 当作“专用网络”：

1. 打开 **设置 → 网络和 Internet → Wi-Fi**；
2. 点当前连接的 Wi-Fi 名称；
3. 把“网络配置文件类型”改成 **“专用网络”**。

> 如果 Wi-Fi 被设成“公用网络”，Windows 防火墙通常会更严格，iPhone 可能打不开页面。

> **如果 DSH 安装在 WSL（Windows 的 Linux 子系统）里**：WSL 默认使用虚拟网卡，局域网里的 iPhone 通常无法直接访问 WSL 内部的端口。这不是插件本身的问题，而是 WSL 的网络隔离。建议把官方 DSH 直接安装在 Windows 本机；如果必须用 WSL，需要额外配置 WSL 端口转发和 Windows 防火墙，超出本插件“零配置”的范围。

### 手机上输入哪个地址

在 Windows 的 DSH 左侧栏点「手机访问」，面板会显示一个地址。  
直接把这个地址输入 iPhone 的 Safari 即可。

两种常见情况：

| Windows 上 DSH 的启动方式 | 手机应该输入的地址 |
|---|---|
| 只监听 `127.0.0.1`（默认） | 面板显示的 `http://<Windows 局域网 IP>:3081/m` |
| 已经监听局域网地址 | 面板显示的 `http://<Windows 局域网 IP>:3080/m` |

**不要输入 `127.0.0.1` 或 `localhost`。**  
这两个地址在 iPhone 上代表“iPhone 自己”，不是你的 Windows 电脑。

如果你不知道 Windows 的局域网 IP：

1. 在 PowerShell 里输入：
   ```powershell
   ipconfig
   ```
2. 找到当前 Wi-Fi 网卡下的 **“IPv4 地址”**；
3. 它通常长这样：`192.168.1.23`；
4. 面板一般会自动显示这个地址，不需要你手动拼。

### 配对（Windows + iPhone）

1. 在 Windows 的 DSH 左侧栏点「手机访问」；
2. 记下面板上的 **8 位配对码**；
3. 在 iPhone Safari 打开面板显示的 `/m` 地址；
4. 输入 8 位数字；
5. 点「连接 DSH」；
6. 进入后，建议点 Safari 的分享按钮 → **“添加到主屏幕”**。

### Windows 常见问题

| 现象 | 最可能的原因 | 怎么解决 |
|---|---|---|
| iPhone 打不开 `/m` | 防火墙没放行 Node.js | 按上面的“Windows 防火墙”步骤，允许“专用网络” |
| iPhone 打不开 `/m` | Windows 和 iPhone 不在同一个 Wi-Fi | 检查两边 Wi-Fi 名称，关掉手机蜂窝网络再试 |
| iPhone 打不开 `/m` | 地址里写了 `127.0.0.1` | 换成面板显示的 Windows 局域网 IP |
| 页面能开，但提示 401 | 打开的是 `/` 而不是 `/m` | 先打开 `/m` 配对，再进入 |
| 提示“配对码已过期” | 8 位码超过 10 分钟 | 在 Windows 面板点“刷新配对码”，用新码重试 |
| 提示“已锁定” | 连续输错次数太多 | 在 Windows 面板刷新配对码，不会自动解锁 |
| `3081` 被占用 | 其他软件占用了端口 | 插件会自动尝试后面 10 个端口，以面板显示为准 |
| 电脑睡眠后手机打不开 | DSH 随电脑睡眠暂停 | 唤醒 Windows，确认 DSH 窗口仍在运行 |
| 公司/学校 Wi-Fi 打不开 | 路由器开了“客户端隔离” | 换家庭 Wi-Fi，或用手机热点让两边连同一个热点 |
| 装了 VPN 后打不开 | VPN 把局域网路由改走 | 临时关闭 VPN，或让 VPN 放行局域网 |

### Windows 和 Mac 有什么区别

| 项目 | Mac | Windows 10/11 |
|---|---|---|
| 安装命令 | 同一条 | 同一条 |
| 终端 | “终端” App | PowerShell |
| 刷新 DSH | `Command + R` | `Ctrl + R` |
| 第一次防火墙 | 通常没有 | 允许 Node.js 访问“专用网络” |
| 回环网关 | 自动使用 `3081` | 自动使用 `3081` |
| iPhone 端操作 | 一样 | 一样 |
| Mac/Windows 原有使用 | 不变 | 不变 |

> Windows 的自动化构建和 33 项测试已在 GitHub 的 Windows CI 上通过。
> 真正挡住小白的通常不是代码，而是“防火墙点了拒绝”或“Wi-Fi 被设成公用网络”。

## 适合谁

- **Mac 或 Windows 10/11** 电脑和 iPhone / iPad 在**同一个 Wi-Fi / 局域网**；
- 电脑上运行的是官方 DeepSeek Harness Web（Mac / Windows 均可）；
- 希望手机用 Safari 完整使用 DSH，而不是只看一个 401 错误页。

## 不适合谁

- 想在**外网**（不在同一个 Wi-Fi）访问家里的电脑：这不是 VPN / 内网穿透工具，请不要把 DSH 直接暴露到公网。
- 电脑上的 DSH 只监听 `127.0.0.1`：`1.1.0` 起插件会**自动**在 `3081` 起一个只做转发的局域网网关，电脑仍用 `127.0.0.1`，不需要改 Host 配置，也不需要把 DSH 暴露到公网。
- 使用 HTTPS 但证书不被 iPhone 信任：Safari 会先拦截证书，这和插件无关。

---

## 安装（Mac 或 Windows 操作，复制即可）

### 第 1 步：确认电脑和 iPhone 连的是同一个 Wi-Fi

iPhone 打开「设置 → 无线局域网」，确认和电脑连的是同一个网络。

### 第 2 步：在 Mac 终端或 Windows PowerShell 执行一条命令

```bash
dsh plugin --profile web add dsh-mobile-access@1.1.8 --registry=https://registry.npmjs.org/
```

这条命令做三件事：

1. 从 npm 下载插件；
2. 装进当前 DSH 的 `web` profile；
3. 自动把它加入 DSH 的插件列表。

> `--profile web` 里的 `web` 是本项目使用的 profile 名称。  
> 如果你的 DSH 用的是其他 profile，把 `web` 换成实际名称即可。  
> 不确定时，照抄这条命令；如果提示 profile 不存在，再检查你平时启动 DSH 用的名称。  
> Windows PowerShell 里也是这一条命令，不需要改引号。

### 如果 DSH 只监听 `127.0.0.1`

从 `1.1.0` 开始不需要改 DSH 配置。插件检测到回环监听后，会自动在
`3081` 起一个只做转发的局域网网关：

- 电脑继续使用原来的 `http://127.0.0.1:3080`，行为不变；
- iPhone 使用面板上显示的 `http://<电脑局域网 IP>:3081/m`；
- 网关会同时转发 DSH 的 `/api/remote.mux` WebSocket，聊天流不受影响；
- 如果 `3081` 被占用，会自动尝试后 10 个端口，面板会显示实际地址。

**Windows 10 / 11 注意**：第一次启动时 Windows 防火墙可能询问是否允许
Node.js 访问网络，请勾选“专用网络”并允许；如果误点了拒绝，到“Windows
安全中心 → 防火墙和网络保护 → 允许应用通过防火墙”里放行 Node.js。

### 第 3 步：刷新 DSH 页面

在 DSH 页面按：

```text
Mac：Command + R
Windows：Ctrl + R
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

## 配对（电脑 + iPhone 一起操作）

### 电脑端（Mac 或 Windows）

1. 打开 DSH Web；
2. 点左侧栏的「手机访问」；
3. 面板会显示：
   - 配对地址，例如 `http://192.168.1.23:3080/m`
   - 8 位配对码，例如 `1234 5678`
   - 剩余有效时间
   - 「复制链接」「复制配对码」「刷新配对码」

### iPhone 端

1. 打开 Safari；
2. 输入电脑面板上显示的 `/m` 地址（不要输成 `127.0.0.1`，也不要用 `localhost`）；
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

### 电脑上有没有变化

没有。

- Mac 和 Windows 上仍然是：**Enter 发送，Shift+Enter 换行**；
- 插件只在 iPhone / iPad 上安装「Return 换行」监听，Mac 和非 Apple 平台不会安装；
- 左边栏只多一个「手机访问」入口，其他入口和面板保持原样。

### iPhone 上切换左侧栏会话为什么要两次点击

如果你在左侧栏已经展开、能看到会话标题的情况下，点第一下没有切换、点第二下才切换，
这是官方会话行的触摸行为：每一行是 `role="treeitem"`、`tabindex="0"` 的可聚焦元素，
iOS Safari 会把第一次触摸先用去聚焦，第二次才派发 `click`。

从 `1.1.4` 起，插件在 iPhone / iPad 上不再依赖“移除 `tabindex` 后等浏览器补发 click”
这一条不确定路径：第一次触摸结束时就主动触发该会话行的点击，并抑制随后可能重复的
原生点击，因此一次点击只会切换一次；切换完成后，窄屏左侧栏会自动收起，把空间还给
对话区。会话行同时加 `touch-action: manipulation`，避免旧式双击缩放延迟。Mac 和
键盘操作不受影响。

如果左侧栏仍然是窄窄的图标条，第一下是展开侧栏——这是官方布局，不是会话行的问题；
展开后每个会话只需单击一次。

### 切换会话后键盘不再自动弹出

从 `1.1.8` 起，iPhone / iPad 上切换会话时，插件会先收起当前输入框的键盘：
旧输入框如果还保持焦点，会立即失焦；会话切换后的 800 毫秒内，如果页面又尝试
用程序方式把焦点塞回输入框，插件也会把它收起。只有你亲手点一下输入框，键盘才会
再次出现。这样切换会话后不会莫名其妙弹出输入法，语音输入和正常打字都不受影响。
Mac 和 Windows 桌面不安装这条 iOS 专属逻辑，行为保持原样。

### iPhone 上展开 / 收起左侧栏

从 `1.1.7` 起，iPhone / iPad 上支持：

- 在对话内容区**向右滑**：展开左侧栏（仅在左侧栏已收起时生效）；
- 在对话内容区**单击一下**：收起已经展开的左侧栏；
- 右滑需要水平距离至少 70px，且明显大于上下移动，避免和滚动、
  横向代码块、输入框、模型菜单和右侧面板冲突；
- 单击收起只对“内容区”生效，点按钮、输入框、链接、代码块、会话行、
  模型菜单或右侧面板不会误收起。

普通 Safari 标签页里，右滑会避开屏幕左右各 24px 的边缘，以免和 Safari
自带的“后退 / 前进”边缘手势抢事件；添加到主屏幕的独立窗口里没有这个
系统手势，因此边缘也可以滑动。Mac 和 Windows 桌面没有安装这些 iOS 专属触摸处理，行为保持原样。

`1.1.3` 的旧实现只移除 `tabindex`，在部分 iOS Safari 版本上仍可能被第一次触摸吃掉；
如果更新到 `1.1.4` 后仍是两次，请彻底关闭这个 Safari 标签页再重新打开（不要只刷新），
以排除旧的 `client.js` 缓存。

### iPhone 上切换大模型时页面放大、键盘自动弹出怎么办

从 `1.1.2` 起不需要改 DSH，也不需要关掉 Safari 的缩放：

- 插件只在 iPhone / iPad 上把可编辑控件（输入框、模型搜索框、提示词编辑器）
  的字号固定到 16px，并给按钮加 `touch-action: manipulation`，避免 iOS
  Safari 因为字号小于 16px 自动放大页面；
- 打开右下角模型选择时，插件不会让模型搜索框自动抢焦点，所以键盘不会自动
  弹出；需要搜索时，点一下搜索框再输入即可；
- 如果提示词键盘本来就是打开的，点模型入口时会先收起键盘；
- 电脑端（Mac / Windows）和非 Apple 平台不安装这些 iOS 专属处理，行为保持原样。

如果页面已经处于放大状态，先点 Safari 地址栏刷新一次，或双击页面空白处
复位，再重新打开模型选择即可。

### 配对码过期了怎么办

配对码默认 **10 分钟**有效。过期后：

1. 回到电脑的「手机访问」面板；
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

1. iPhone 和电脑是不是同一个 Wi-Fi；
2. 地址是不是电脑面板上显示的**完整地址**（回环监听时通常是 `:3081`，局域网监听时可能是 `:3080`）；
3. 电脑面板的「局域网网关」是否显示「已开启」；如果显示错误，按提示检查 Windows 防火墙或端口占用；
4. 路由器是否开启了「客户端隔离 / AP 隔离」（开启后同一 Wi-Fi 的设备也不能互访）。

### 2. 左边栏没有「手机访问」

- 先刷新 DSH 页面（Mac 按 `Command + R`，Windows 按 `Ctrl + R`）；
- 再确认安装命令没有报错；
- 检查 `dsh plugin --profile web why dsh-mobile-access`；
- 如果刚安装完仍没有，按插件管理器提示判断是否需要手动重启 DSH。

### 3. 输入配对码后提示「已锁定」

这是安全设计，不会自动解锁。  
在电脑面板点「刷新配对码」，然后用新码重试。

### 4. 提示「请求未通过 Host 或来源校验」

- 确认你访问的是电脑面板上显示的完整地址（包括实际端口，回环网关通常是 `:3081`）；
- 不要用另一个域名 / IP 混着访问；
- 升级到 `1.1.0` 及以上版本。`1.1.0` 同时修复早期 iOS Safari 表单提交被误判的问题，并加入回环网关。

### 5. iPhone 按 Return 还是直接发送

- 确认版本是 `1.1.0` 或更高；
- 安装/升级后刷新一次页面，让新的 `client.js` 生效；
- 如果仍然直接发送，请记录 iPhone 型号、iOS 版本和页面地址，提交 issue。

### 6. 复制按钮没反应

- 插件在 iOS 的普通 HTTP 页面上提供剪贴板回退；
- 如果仍然失败，长按文字手动复制；
- 电脑端不受这个回退影响。

### 7. 安卓手机 / Windows 电脑上的浏览器能用吗

- 配对页 `/m` 对现代浏览器通用；
- 左侧栏面板在所有 DSH Web 客户端显示；
- iOS 专属补丁（Return 换行、防自动放大、侧栏手势）只在 iPhone / iPad 上安装，安卓和 Windows 浏览器不会启用这些补丁；
- 在 Windows 电脑本机浏览器里打开 DSH，与在 Mac 本机浏览器里打开一样，原有行为不变。

---

## 它是怎么工作的（技术小白可跳过）

```text
┌─────────────────────────────┐
│ 电脑上的 DSH Web            │
│                             │
│  host 插件                   │
│   ├─ GET  /m                │  配对页：短地址 + 8 位码
│   ├─ POST /m                │  校验 nonce/码，签发 Cookie
│   ├─ GET  /api/.../state    │  仅电脑面板可读
│   └─ POST /api/.../rotate   │  仅电脑面板可刷新
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
dsh plugin --profile web add dsh-mobile-access@1.1.8 --registry=https://registry.npmjs.org/
```

### 使用 `@latest`

```bash
dsh plugin --profile web add dsh-mobile-access@latest --registry=https://registry.npmjs.org/
```

说明：pnpm 的默认镜像可能比 npm 官方源晚同步。  
如果 `@latest` 装到旧版，请使用上面的精确版本，或加 `--registry=https://registry.npmjs.org/`。

### 从本机目录安装（开发 / 离线）

```bash
git clone https://github.com/abbaababa/dsh-mobile-access.git
cd dsh-mobile-access
npm install
npm run verify
dsh plugin --profile web add /absolute/path/to/dsh-mobile-access
```

### 从 tarball 安装

```bash
npm pack
dsh plugin --profile web add /absolute/path/to/dsh-mobile-access-1.1.0.tgz
```

> GitHub 仓库是源码与文档的家；日常安装请优先用 npm 一条命令，不要求用户自己编译。

---

## 开发与验证（技术读者）

要求：

- Node.js >= 22
- npm
- 不需要 DSH 源码 checkout

```bash
git clone https://github.com/abbaababa/dsh-mobile-access.git
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
- iOS 剪贴板回退、Return 换行监听、16px 缩放守卫和模型搜索焦点守卫被清理。

已签发的登录 Cookie 可能仍留在浏览器中，直到过期；这是 DSH 认证层的行为，不是插件额外写入的凭证。

---

## 版本

- `1.0.0` — 首个工程化版本：配对页、owner-only 状态/刷新、左侧栏面板、零 Mac 影响边界、单元/路由/静态门禁。
- `1.0.1` — 安装文档与 npm 发布元数据。
- `1.0.2` — iPhone / iPad 自带键盘 Return 换行。
- `1.0.3` — Safari 不支持改写键盘事件时的换行回退。
- `1.1.0` — 回环监听自动局域网网关（macOS / Windows，HTTP + `/api/remote.mux` WebSocket）。
- `1.1.1` — iPhone / iPad 上模型选择页 16px 缩放守卫。
- `1.1.2` — 打开模型选择时不自动弹键盘、不整体上移。
- `1.1.8` — iPhone / iPad 上切换会话后不再自动弹出输入法键盘；当前 npm `latest`。
- `1.1.7` — iPhone / iPad 上右滑展开左侧栏，点击内容区收起。
- `1.1.6` — iPhone / iPad 上右滑展开、左滑收起左侧栏。
- `1.1.5` — Tailscale Serve 经 HTTPS 访问时，允许带 Tailscale 身份头的 `*.ts.net` Host（仅限本机回环转发）。
- `1.1.4` — iPhone / iPad 上第一次点击直接切换会话，并在切换后自动收起左侧栏。
- `1.1.3` — 首次尝试临时移除会话行 `tabindex`。

## 许可证

[MIT](LICENSE)

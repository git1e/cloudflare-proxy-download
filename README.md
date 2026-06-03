# Cloudflare Proxy Download

基于 Cloudflare Workers 的反向代理下载中转站，用于解决国内网络访问国外软件资源受限的问题。支持代理任意 HTTP/HTTPS 下载链接。

## 文件结构

```
├── worker.js    # Cloudflare Workers 反向代理脚本
└── index.html   # 下载页面外壳（单页应用）
```

## 快速部署

### 1. 部署 Worker 代理

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → 创建应用程序 → 创建 Worker
2. 将 `worker.js` 内容粘贴到编辑器中
3. 如需限制代理范围，可修改黑名单配置：

```js
const BLOCKED_DOMAINS = ['blocked-site.com'];  // 留空则不限制
```

4. 点击"保存并部署"，记下 Worker 的域名（如 `proxy-download.你的用户名.workers.dev`）

### 2. 部署下载页面

`index.html` 会自动使用当前页面所在域名作为代理地址，无需额外配置。

通过以下任一方式部署：
- **Cloudflare Pages**：将 `index.html` 上传到 Pages 项目，添加环境变量或直接与 Worker 绑定
- **直接嵌入 Worker**：在 `worker.js` 中添加路由返回此 HTML 作为静态页面，确保与 Worker 同域

## 使用方式

1. 打开部署好的下载页面
2. 粘贴需要下载的国外软件直链（如 `https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso`）
3. 点击"开始下载"，文件将通过 Worker 代理中转

## 工作原理

```
用户浏览器 ──► 下载页面 ──► Cloudflare Worker ──► 目标服务器
                 ?url=...              │
                          请求头伪装（Host/Origin/Referer）
                          流式传输（不缓存到内存）
                          CORS 头注入
```

Worker 通过 `?url=<目标链接>` 查询参数接收要代理的地址，动态解析目标域名并伪装请求头，对任意 HTTP/HTTPS 链接进行透明转发。

## 自定义配置

| 配置项 | 位置 | 说明 |
|--------|------|------|
| User-Agent | `worker.js` 第 15 行 | 伪装请求的浏览器标识 |
| 域名黑名单 | `worker.js` 第 19 行 | 禁止代理的域名列表，留空不限制 |

## 免费版注意事项

Cloudflare Workers 免费版每日有 10 万次请求限制。建议：

- 可配置 `BLOCKED_DOMAINS` 域名黑名单防止滥用
- 可搭配 Cloudflare 的速率限制规则（Rate Limiting）
- 对流量较大的场景，考虑升级到付费计划

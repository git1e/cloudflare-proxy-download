/**
 * Cloudflare Workers 反向代理 —— 下载中转站（支持任意下载链接）
 * 
 * 使用说明：
 *   1. 将本文件内容粘贴到 Cloudflare Workers 编辑器中部署
 *   2. 调用方式：GET https://你的worker域名/?url=<目标文件直链>
 *   3. Worker 会将请求代理到 url 参数指定的地址，自动伪装请求头并添加 CORS
 */

// ============================================================
// HTML 页面 —— 首页前端界面
// ============================================================
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>下载中转站</title>
  <style>
    /* ============================================================
       CSS 变量 —— 自适应浅色 / 深色主题
       ============================================================ */
    :root {
      --bg: #ffffff;
      --bg-secondary: #f6f8fa;
      --card-bg: #ffffff;
      --card-border: #d0d7de;
      --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06);
      --text-primary: #1f2328;
      --text-secondary: #656d76;
      --text-muted: #8b949e;
      --accent: #0969da;
      --accent-hover: #0550ae;
      --accent-fg: #ffffff;
      --input-bg: #f6f8fa;
      --input-border: #d0d7de;
      --input-focus-ring: #0969da;
      --divider: #d0d7de;
      --toast-bg: #1f2328;
      --toast-fg: #ffffff;
      --toast-error-bg: #cf222e;
      --toast-success-bg: #1a7f37;
      --icon-color: #656d76;
      --badge-bg: #ddf4ff;
      --badge-fg: #0969da;
      --radius: 12px;
      --radius-sm: 8px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --bg-secondary: #161b22;
        --card-bg: #161b22;
        --card-border: #30363d;
        --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4);
        --text-primary: #e6edf3;
        --text-secondary: #8b949e;
        --text-muted: #6e7681;
        --accent: #58a6ff;
        --accent-hover: #79c0ff;
        --accent-fg: #0d1117;
        --input-bg: #0d1117;
        --input-border: #30363d;
        --input-focus-ring: #58a6ff;
        --divider: #30363d;
        --toast-bg: #e6edf3;
        --toast-fg: #0d1117;
        --toast-error-bg: #f85149;
        --toast-success-bg: #3fb950;
        --icon-color: #8b949e;
        --badge-bg: #121d2f;
        --badge-fg: #58a6ff;
      }
    }

    /* ============================================================
       全局重置与基础样式
       ============================================================ */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
        Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      background: var(--bg);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      transition: background 0.3s ease, color 0.3s ease;
    }

    /* ============================================================
       卡片容器
       ============================================================ */
    .card {
      width: 100%;
      max-width: 520px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      box-shadow: var(--card-shadow);
      padding: 2.5rem 2rem;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }

    @media (max-width: 480px) {
      .card {
        padding: 1.75rem 1.25rem;
      }
    }

    /* ============================================================
       头部
       ============================================================ */
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--accent);
      color: var(--accent-fg);
      margin-bottom: 1rem;
    }

    .logo svg {
      width: 24px;
      height: 24px;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.375rem;
    }

    .subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .badge-row {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 0.75rem;
      padding: 0.2em 0.6em;
      border-radius: 999px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      font-weight: 500;
    }

    /* ============================================================
       表单区域
       ============================================================ */
    .form-group {
      margin-bottom: 1rem;
    }

    .input-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .input-wrapper {
      position: relative;
    }

    .url-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      color: var(--text-primary);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-sm);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .url-input::placeholder {
      color: var(--text-muted);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.875rem;
    }

    .url-input:focus {
      border-color: var(--input-focus-ring);
      box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
    }

    @media (prefers-color-scheme: dark) {
      .url-input:focus {
        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
      }
    }

    /* ============================================================
       按钮
       ============================================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem 1.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--accent-fg);
      background: var(--accent);
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .btn:hover:not(:disabled) {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(9, 105, 218, 0.3);
    }

    .btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }

    .btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    /* Loading 旋转动画 */
    .spinner {
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* ============================================================
       提示信息
       ============================================================ */
    .hint {
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* ============================================================
       Toast 弹窗
       ============================================================ */
    .toast-container {
      position: fixed;
      top: 1.25rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
      width: calc(100% - 2rem);
      max-width: 480px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.4;
      color: #ffffff;
      background: var(--toast-bg);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      animation: toastIn 0.3s ease forwards;
    }

    .toast.leaving {
      animation: toastOut 0.25s ease forwards;
    }

    .toast.error {
      background: var(--toast-error-bg);
    }

    .toast.success {
      background: var(--toast-success-bg);
    }

    .toast svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes toastOut {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-12px);
      }
    }

    /* ============================================================
       分隔线
       ============================================================ */
    .divider {
      border: none;
      border-top: 1px solid var(--divider);
      margin: 1.25rem 0;
    }

    /* ============================================================
       底部说明
       ============================================================ */
    .footer-note {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.5;
    }

    .footer-note code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      background: var(--input-bg);
      padding: 0.1em 0.4em;
      border-radius: 4px;
      font-size: 0.8125rem;
    }
  </style>
</head>
<body>
  <!-- Toast 容器 -->
  <div class="toast-container" id="toastContainer"></div>

  <!-- 主卡片 -->
  <main class="card">
    <!-- 头部 -->
    <header class="header">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>
      <h1 class="title">下载中转站</h1>
      <p class="subtitle">通过边缘代理加速访问国外软件资源，解决网络受限问题</p>
      <div class="badge-row">
        <span class="badge">Cloudflare Workers</span>
        <span class="badge">全球加速</span>
        <span class="badge">流式传输</span>
      </div>
    </header>

    <hr class="divider" />

    <!-- 输入与下载区域 -->
    <form id="downloadForm" autocomplete="off">
      <div class="form-group">
        <label class="input-label" for="urlInput">粘贴国外软件直链</label>
        <div class="input-wrapper">
          <input
            id="urlInput"
            class="url-input"
            type="url"
            placeholder="https://example.com/releases/app-latest.zip"
            required
          />
        </div>
      </div>

      <button type="submit" class="btn" id="submitBtn">
        <!-- 默认图标：下载 -->
        <svg id="btnIconDefault" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <!-- Loading 图标 -->
        <svg id="btnIconLoading" class="spinner" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" style="display:none;">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" />
        </svg>
        <span id="btnText">开始下载</span>
      </button>

      <p class="hint">输入链接后点击按钮，文件将通过代理服务器中转下载</p>
    </form>

    <hr class="divider" />

    <!-- 底部说明 -->
    <p class="footer-note">
      本服务基于 Cloudflare Workers 构建，支持代理任意 HTTP/HTTPS 下载链接。<br />
      可在 <code>worker.js</code> 中配置 <code>BLOCKED_DOMAINS</code> 域名黑名单防止滥用。
    </p>
  </main>

  <script>
    (function () {
      // ============================================================
      // 自动获取当前页面的域名作为代理地址，无需手动配置
      // 如果页面和 Worker 不在同一域名，可手动覆盖：
      // const PROXY_BASE_URL = 'https://你的worker域名.workers.dev';
      // ============================================================
      const PROXY_BASE_URL = location.origin;

      // ============================================================
      // DOM 元素引用
      // ============================================================
      const form = document.getElementById('downloadForm');
      const urlInput = document.getElementById('urlInput');
      const submitBtn = document.getElementById('submitBtn');
      const btnText = document.getElementById('btnText');
      const btnIconDefault = document.getElementById('btnIconDefault');
      const btnIconLoading = document.getElementById('btnIconLoading');
      const toastContainer = document.getElementById('toastContainer');

      // ============================================================
      // 按钮状态切换
      // ============================================================
      function setLoading(isLoading) {
        if (isLoading) {
          submitBtn.disabled = true;
          btnIconDefault.style.display = 'none';
          btnIconLoading.style.display = 'block';
          btnText.textContent = '解析链接中...';
        } else {
          submitBtn.disabled = false;
          btnIconDefault.style.display = 'block';
          btnIconLoading.style.display = 'none';
          btnText.textContent = '开始下载';
        }
      }

      // ============================================================
      // Toast 提示
      // ============================================================
      function showToast(message, type) {
        // type: 'info' | 'error' | 'success'
        type = type || 'info';

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;

        // 图标
        var iconSvg = '';
        if (type === 'error') {
          iconSvg =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        } else if (type === 'success') {
          iconSvg =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else {
          iconSvg =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        toast.innerHTML = iconSvg + '<span>' + escapeHtml(message) + '</span>';
        toastContainer.appendChild(toast);

        // 3 秒后自动消失
        setTimeout(function () {
          toast.classList.add('leaving');
          toast.addEventListener('animationend', function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
          });
        }, 3000);
      }

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      }

      // ============================================================
      // 校验 URL
      // ============================================================
      function isValidUrl(str) {
        try {
          var u = new URL(str);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (_) {
          return false;
        }
      }

      function hasFileExtension(url) {
        try {
          var u = new URL(url);
          return /\/[^\/]+\.[a-z0-9]+($|[?#])/i.test(u.pathname);
        } catch (_) {
          return false;
        }
      }

      // ============================================================
      // 将完整目标 URL 作为 ?url= 参数传给 Worker
      // ============================================================
      function buildProxyUrl(originalUrl) {
        return PROXY_BASE_URL + '?url=' + encodeURIComponent(originalUrl);
      }

      // ============================================================
      // 触发下载
      // ============================================================
      function triggerDownload(proxyUrl, originalUrl) {
        // 使用 fetch + blob 方式下载文件，避免跨域导航问题
        fetch(proxyUrl)
          .then(function (response) {
            if (!response.ok) {
              throw new Error('HTTP ' + response.status);
            }
            return response.blob();
          })
          .then(function (blob) {
            // 从 Content-Disposition 或原始 URL 提取文件名
            var filename = 'download';
            try {
              var url = new URL(originalUrl);
              var pathname = url.pathname;
              if (pathname) {
                filename = pathname.split('/').pop() || 'download';
                // 移除查询参数
                filename = filename.split('?')[0];
              }
            } catch (_) {}

            // 创建临时下载链接
            var blobUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          })
          .catch(function (err) {
            showToast('下载失败：' + (err.message || '未知错误'), 'error');
          });
      }

      // ============================================================
      // 表单提交处理
      // ============================================================
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var rawUrl = urlInput.value.trim();

        // 校验
        if (!rawUrl) {
          showToast('请输入下载链接', 'error');
          urlInput.focus();
          return;
        }

        if (!isValidUrl(rawUrl)) {
          showToast('请输入有效的 HTTP/HTTPS 链接', 'error');
          urlInput.focus();
          return;
        }

        // 进入 Loading 状态
        setLoading(true);

        var proxyUrl = buildProxyUrl(rawUrl);

        // 先通过 fetch 探测代理是否可达（HEAD 请求，极轻量）
        fetch(proxyUrl, { method: 'HEAD' })
          .then(function (res) {
            if (!res.ok) {
              // 服务端返回错误
              return res.json().then(function (data) {
                throw new Error(data.message || '服务器返回 HTTP ' + res.status);
              }).catch(function () {
                // 无法解析 JSON 时使用状态码信息
                throw new Error('服务器返回 HTTP ' + res.status);
              });
            }

            var contentType = res.headers.get('content-type') || '';
            if (contentType.indexOf('text/html') !== -1 && !hasFileExtension(rawUrl)) {
              throw new Error('目标链接返回 HTML 页面，无法直接下载文件');
            }

            // 可达，触发下载
            triggerDownload(proxyUrl, rawUrl);
            showToast('开始下载，请查看浏览器下载列表，下载可能会延迟开始，请耐心等待。', 'success');
          })
          .catch(function (err) {
            // 网络错误或 CORS 错误（HEAD 可能被 CORS 阻挡时会抛 TypeError）
            // 对于 CORS 错误，仍然尝试触发下载（fetch 请求自动跟随 CORS）
            if (err instanceof TypeError && err.message.indexOf('Failed to fetch') !== -1) {
              // 可能是 CORS 阻止了 HEAD 探测，直接尝试触发下载
              triggerDownload(proxyUrl, rawUrl);
              showToast('开始下载，请查看浏览器下载列表', 'success');
            } else {
              showToast(err.message || '网络连接失败，请稍后重试', 'error');
            }
          })
          .finally(function () {
            setLoading(false);
          });
      });

      // ============================================================
      // 粘贴后自动去除首尾空白
      // ============================================================
      urlInput.addEventListener('paste', function () {
        setTimeout(function () {
          urlInput.value = urlInput.value.trim();
        }, 0);
      });
    })();
  </script>
</body>
</html>`;

// ============================================================
// 配置区 —— 请按需修改
// ============================================================

/** 常见的浏览器 User-Agent，用于伪装请求来源 */
const FAKE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** 可选：域名黑名单，禁止代理这些域名的资源（留空则不限制） */
const BLOCKED_DOMAINS = [];

// ============================================================
// 工具函数
// ============================================================

/**
 * 构建转发到目标服务器的请求头
 * 将请求来源伪装成目标域名自身，绕过防盗链和主机验证
 */
function buildProxyHeaders(originalHeaders, targetUrl) {
  const proxyHeaders = new Headers();

  // 复制部分原始请求头
  const headersToCopy = [
    'accept-encoding',
    'accept-language',
    'cache-control',
    'if-modified-since',
    'if-none-match',
    'range', // 支持断点续传
  ];

  for (const name of headersToCopy) {
    const value = originalHeaders.get(name);
    if (value) proxyHeaders.set(name, value);
  }

  // 统一设置 Accept，避免浏览器导航请求被目标服务器识别为 HTML 页面请求
  proxyHeaders.set('Accept', '*/*');

  // 伪装为目标域名的请求头
  proxyHeaders.set('Host', targetUrl.hostname);
  proxyHeaders.set('Origin', targetUrl.origin);
  proxyHeaders.set('Referer', targetUrl.origin + '/');
  proxyHeaders.set('User-Agent', FAKE_USER_AGENT);

  return proxyHeaders;
}

/**
 * 为响应添加 CORS 头部，允许前端页面跨域调用
 * 同时确保 Content-Disposition 头存在，以便浏览器能够触发下载
 */
function addCorsHeaders(response, origin, targetUrl) {
  const corsHeaders = new Headers(response.headers);

  corsHeaders.set('Access-Control-Allow-Origin', origin || '*');
  corsHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  corsHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Content-Disposition');
  corsHeaders.set('Access-Control-Max-Age', '86400');

  // 如果响应中没有 Content-Disposition 头，从 URL 中提取文件名并添加
  if (!corsHeaders.has('Content-Disposition') && targetUrl) {
    try {
      const url = new URL(targetUrl);
      const pathname = url.pathname;
      let filename = pathname.split('/').pop() || 'download';
      // 移除查询参数
      filename = filename.split('?')[0];
      if (filename) {
        corsHeaders.set('Content-Disposition', `attachment; filename="${encodeURI(filename)}"`);
      }
    } catch (_) {
      // 如果无法解析 URL，使用默认文件名
      if (!corsHeaders.has('Content-Disposition')) {
        corsHeaders.set('Content-Disposition', 'attachment; filename="download"');
      }
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: corsHeaders,
  });
}

/**
 * 返回 JSON 格式的错误信息
 */
function jsonError(message, status = 502) {
  return new Response(JSON.stringify({ error: true, message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ============================================================
// 主处理逻辑
// ============================================================

export default {
  async fetch(request, env, ctx) {
    try {
      const workerUrl = new URL(request.url);

      // ---------- CORS 预检请求处理 ----------
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // ---------- 仅允许 GET/HEAD 请求 ----------
      if (!['GET', 'HEAD'].includes(request.method)) {
        return jsonError('仅支持 GET / HEAD 请求', 405);
      }

      // ---------- 从查询参数中提取目标 URL ----------
      const targetUrlParam = workerUrl.searchParams.get('url');

      // ---------- 如果没有 url 参数且是 GET 请求，返回首页 HTML ----------
      if (!targetUrlParam && request.method === 'GET') {
        return new Response(HTML, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      if (!targetUrlParam) {
        return jsonError('缺少 url 参数。用法：?url=<目标文件直链>', 400);
      }

      // ---------- 校验目标 URL ----------
      let targetUrl;
      try {
        targetUrl = new URL(targetUrlParam);
      } catch (_) {
        return jsonError('url 参数格式无效，请提供完整的 HTTP/HTTPS 链接', 400);
      }

      // 仅允许 HTTP/HTTPS 协议
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return jsonError('仅支持 HTTP/HTTPS 协议', 400);
      }

      // ---------- 域名黑名单校验 ----------
      if (BLOCKED_DOMAINS.length > 0) {
        const hostname = targetUrl.hostname.toLowerCase();
        const blocked = BLOCKED_DOMAINS.some(
          (domain) => hostname === domain || hostname.endsWith('.' + domain)
        );
        if (blocked) {
          return jsonError(`域名 "${targetUrl.hostname}" 不允许代理`, 403);
        }
      }

      // ---------- 构建代理请求头 ----------
      const proxyHeaders = buildProxyHeaders(request.headers, targetUrl);

      // ---------- 发起对目标服务器的请求（流式传输，不缓存到内存） ----------
      const upstreamResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: proxyHeaders,
        redirect: 'follow',
      });

      // ---------- 添加 CORS 头并返回 ----------
      const origin = request.headers.get('Origin') || '*';
      return addCorsHeaders(upstreamResponse, origin, targetUrl.toString());

    } catch (err) {
      // ---------- 全局异常捕获 ----------
      console.error('代理请求异常:', err.message);
      return jsonError(
        `代理请求失败：${err.message || '未知错误'}`,
        502
      );
    }
  },
};

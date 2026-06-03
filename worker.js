/**
 * Cloudflare Workers 反向代理 —— 下载中转站（支持任意下载链接）
 * 
 * 使用说明：
 *   1. 将本文件内容粘贴到 Cloudflare Workers 编辑器中部署
 *   2. 调用方式：GET https://你的worker域名/?url=<目标文件直链>
 *   3. Worker 会将请求代理到 url 参数指定的地址，自动伪装请求头并添加 CORS
 */

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
 */
function addCorsHeaders(response, origin) {
  const corsHeaders = new Headers(response.headers);

  corsHeaders.set('Access-Control-Allow-Origin', origin || '*');
  corsHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  corsHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
  corsHeaders.set('Access-Control-Max-Age', '86400');

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
      return addCorsHeaders(upstreamResponse, origin);

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

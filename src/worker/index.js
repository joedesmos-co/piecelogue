import { handleApi } from './api/index'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx)
    }

    // Let Cloudflare Static Assets serve files and SPA-fallback for everything else.
    // This preserves the existing React SPA behavior for /, /app, and public pages.
    return env.ASSETS.fetch(request)
  },
}


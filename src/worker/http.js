function jsonBody(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function jsonOk(body, status = 200) {
  return jsonBody(body, status)
}

export function jsonError(status, code, message, details = null) {
  return jsonBody(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status,
  )
}

export function notFound() {
  return jsonError(404, 'not_found', 'Not found')
}

export function methodNotAllowed(allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
  return jsonBody(
    {
      ok: false,
      error: {
        code: 'method_not_allowed',
        message: 'Method not allowed',
        allowed,
      },
    },
    405,
  )
}

// TODO: Add CORS headers only if/when you need cross-origin requests.
// For now, Piecelogue API calls are same-origin.
export function withCors(response, origin = '*') {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(response.body, { ...response, headers })
}


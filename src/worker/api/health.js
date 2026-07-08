import { jsonOk, methodNotAllowed } from '../http'

const APP_NAME = 'Piecelogue'
const VERSION = '0.1.0'

export function handleHealth(request) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  return jsonOk(
    {
      ok: true,
      app: APP_NAME,
      version: VERSION,
    },
    200,
    { 'x-piecelogue-api': 'health' },
  )
}


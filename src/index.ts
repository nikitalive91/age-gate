import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface VerifyRequestBody {
  proof?: string
  merkle_root?: string
  nullifier_hash?: string
  verification_level?: string
  action?: string
  signal?: string
}

interface WorldcoinVerifyResponse {
  success?: boolean
  nullifier_hash?: string
  detail?: string
  code?: string
  attribute?: string
}

interface ConfigResponse {
  app_id: string
  action: string
}

interface VerifySuccessResponse {
  verified: true
  nullifier_hash: string
  demo?: boolean
  message?: string
}

interface VerifyErrorResponse {
  verified: false
  error: string
}

interface ContentSuccessResponse {
  message: string
  content: string
}

interface ContentErrorResponse {
  error: string
  status: number
}

// ─── In-memory storage ──────────────────────────────────────────────────────

const verifiedNullifiers: Set<string> = new Set()

// ─── App ────────────────────────────────────────────────────────────────────

const app = new Hono()

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'AgeGate', timestamp: new Date().toISOString() })
})

// ─── Task 1: GET /config ────────────────────────────────────────────────────

app.get('/config', (c) => {
  const config: ConfigResponse = {
    app_id: process.env.WORLD_APP_ID ?? '',
    action: process.env.WORLD_ACTION ?? 'verify-age',
  }
  console.log('[config] Serving public config:', config)
  return c.json(config)
})

// ─── Task 2 + 3: POST /verify-age ──────────────────────────────────────────

app.post('/verify-age', async (c) => {
  let body: VerifyRequestBody
  try {
    body = await c.req.json<VerifyRequestBody>()
  } catch {
    return c.json<VerifyErrorResponse>({ verified: false, error: 'Invalid JSON body' }, 400)
  }

  const { proof, merkle_root, nullifier_hash, verification_level, action, signal } = body

  // Demo mode: no proof in body
  if (!proof) {
    const demoNullifier = `demo_${Date.now()}`
    verifiedNullifiers.add(demoNullifier)
    console.log('[verify] Demo mode — nullifier:', demoNullifier)
    return c.json<VerifySuccessResponse>({
      verified: true,
      demo: true,
      nullifier_hash: demoNullifier,
      message: 'Demo mode — no proof provided',
    })
  }

  // Task 3: Check for duplicate nullifier BEFORE calling Worldcoin API
  if (nullifier_hash && verifiedNullifiers.has(nullifier_hash)) {
    console.log('[verify] Duplicate nullifier rejected:', nullifier_hash)
    return c.json<VerifyErrorResponse>({ verified: false, error: 'Already verified' }, 400)
  }

  // Real World ID verification
  const appId = process.env.WORLD_APP_ID ?? ''
  if (!appId) {
    return c.json<VerifyErrorResponse>(
      { verified: false, error: 'WORLD_APP_ID not configured on server' },
      500,
    )
  }

  try {
    console.log('[verify] Calling Worldcoin API for app:', appId)
    const res = await fetch(`https://developer.worldcoin.org/api/v2/verify/${appId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof,
        merkle_root,
        nullifier_hash,
        verification_level: verification_level ?? 'orb',
        action: action ?? process.env.WORLD_ACTION ?? 'verify-age',
        signal: signal ?? '',
      }),
    })

    const data = (await res.json()) as WorldcoinVerifyResponse

    if (!res.ok) {
      console.log('[verify] Worldcoin API error:', data.detail ?? res.status)
      return c.json<VerifyErrorResponse>(
        { verified: false, error: data.detail ?? 'Verification failed' },
        400,
      )
    }

    // Success — add nullifier to verified set
    const verifiedNullifier = data.nullifier_hash ?? nullifier_hash ?? ''
    verifiedNullifiers.add(verifiedNullifier)
    console.log('[verify] Success — nullifier added:', verifiedNullifier)

    return c.json<VerifySuccessResponse>({
      verified: true,
      nullifier_hash: verifiedNullifier,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[verify] Network error calling Worldcoin API:', message)
    return c.json<VerifyErrorResponse>(
      { verified: false, error: `Worldcoin API error: ${message}` },
      502,
    )
  }
})

// ─── Task 4: GET /content with Bearer auth ──────────────────────────────────

app.get('/content', (c) => {
  const authHeader = c.req.header('Authorization')

  // No token → 402 Payment Required
  if (!authHeader) {
    console.log('[content] No Authorization header — 402')
    return c.json<ContentErrorResponse>(
      { error: 'Payment Required — verify your age first', status: 402 },
      402,
    )
  }

  // Parse Bearer token
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('[content] Malformed Authorization header — 401')
    return c.json<ContentErrorResponse>(
      { error: 'Unauthorized — invalid token format', status: 401 },
      401,
    )
  }

  const token = parts[1]

  // Check if token is in verified set
  if (!verifiedNullifiers.has(token)) {
    console.log('[content] Invalid nullifier token — 401:', token)
    return c.json<ContentErrorResponse>(
      { error: 'Unauthorized — token not recognized', status: 401 },
      401,
    )
  }

  // Valid token — serve content
  console.log('[content] Access granted for nullifier:', token)
  return c.json<ContentSuccessResponse>({
    message: 'Access granted — age verified via World ID',
    content: 'This is the protected 18+ content. Your age was verified using a zero-knowledge proof through World ID. No personal data was shared.',
  })
})

// Static files (public/) — must be last so API routes take priority
app.use('/*', serveStatic({ root: './public' }))

// ─── Server ─────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 4021
serve({ fetch: app.fetch, port: PORT })
console.log(`AgeGate running on http://localhost:${PORT}`)

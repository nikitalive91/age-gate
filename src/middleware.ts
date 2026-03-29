/**
 * AgeGate Hono Middleware
 *
 * Usage:
 *   import { ageGate } from '@agegate/sdk'
 *   app.use('/api/*', ageGate({ price: '9.99' }))
 *
 * - If the request has a valid Bearer token (verified nullifier) → next()
 * - Otherwise → 402 with x402 payment metadata
 */

import type { MiddlewareHandler } from 'hono'
import { verifiedNullifiers } from './store'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgeGateOptions {
  /** Price in USDC (e.g. '9.99') — default '0.01' */
  price?: string
  /** Human-readable description */
  description?: string
  /** Ethereum address to receive payment */
  payTo?: string
  /** USDC contract address — default Base Sepolia USDC */
  asset?: string
  /** EIP-155 chain ID — default 'eip155:84532' (Base Sepolia) */
  network?: string
  /** Timeout in seconds — default 300 */
  maxTimeoutSeconds?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert human price string (e.g. '9.99') to USDC atomic units (6 decimals) */
function priceToAtomic(price: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return '0'
  return Math.round(num * 1_000_000).toString()
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function ageGate(options: AgeGateOptions = {}): MiddlewareHandler {
  const {
    price           = '0.01',
    description     = 'AgeGate — age-verified access',
    payTo           = '0x0000000000000000000000000000000000000000',
    asset           = '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
    network         = 'eip155:84532',
    maxTimeoutSeconds = 300,
  } = options

  return async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (authHeader) {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1]
        if (verifiedNullifiers.has(token)) {
          // Valid human credential — pass through for free
          await next()
          return
        }
      }
    }

    // No valid credential — return 402 with x402 payment metadata
    const paymentRequired = {
      scheme: 'exact',
      network,
      maxAmountRequired: priceToAtomic(price),
      resource: c.req.url,
      description,
      mimeType: 'application/json',
      payTo,
      maxTimeoutSeconds,
      asset,
      extra: {
        name: 'AgeGate Access',
        description: `Verified humans get free access. Bots pay $${price} USDC.`,
      },
    }

    c.header('X-402-Version', '1')
    return c.json({
      error: 'Payment Required',
      x402Version: 1,
      accepts: [paymentRequired],
    }, 402)
  }
}

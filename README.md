# AgeGate

**Privacy-first age verification middleware powered by World ID.** Any website can verify that a visitor is 18+ using a zero-knowledge proof — the site receives only yes or no, no personal data is ever shared or stored. AI agents can also pass age gates via AgentKit (proof of human), and access is gated by x402 micropayments in USDC.

---

## The Problem

Current age verification methods are fundamentally broken:

| Method | Problem |
|---|---|
| Passport / ID upload | Stores sensitive government documents on third-party servers |
| Facial age estimation | Biometric data collected, often shared or breached |
| Credit card check | Excludes minors with cards; doesn't prove age |
| Self-declaration checkbox | Completely unenforceable |
| VPN / workarounds | Users route around all of the above trivially |

The result: either surveillance-heavy verification that users avoid, or no real verification at all.

---

## The Solution

AgeGate uses **World ID Credentials** — a zero-knowledge proof system built on the World network:

- **User proves age** through World App (Orb-verified biometric, done once)
- **ZK proof generated** on-device: "this person is 18+, verified by World ID"
- **Site receives** only a cryptographic yes/no — no name, no birthdate, no document
- **Nullifier hash** prevents the same proof from being reused (prevents double-verification)
- **AI agents** pass age gates via AgentKit (3 free-trial uses per registered human-backed agent)
- **Access payment** via x402 micropayment protocol in USDC on World Chain or Base

```
User                    AgeGate Server              World ID
 │                           │                          │
 │── POST /verify-age ───────▶                          │
 │   (ZK proof from app)     │── verify(proof) ────────▶│
 │                           │◀─ { verified: true } ────│
 │◀── { verified: true } ────│                          │
 │                           │                          │
 │── GET /content ───────────▶                          │
 │   (x402 USDC payment)     │                          │
 │◀── 200 + content ─────────│                          │
```

---

## How to Run Locally

### Prerequisites

- Node.js 20+
- World App on your phone (for real verification)
- World ID App ID from [developer.worldcoin.org](https://developer.worldcoin.org) *(optional — demo mode works without it)*

### 1. Clone and install

```bash
git clone <repo>
cd AgeGate
npm install
```

### 2. Configure environment (optional)

Create a `.env` file:

```env
# From https://developer.worldcoin.org → New App → Action: "verify-age"
WORLD_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Your wallet address to receive x402 USDC payments
PAY_TO=0xYourWalletAddress
```

If `WORLD_APP_ID` is not set, the server runs in **demo mode** — all verifications are simulated.

### 3. Start the server

```bash
npm run dev        # development (auto-restart on file change)
npm start          # production
```

Open **http://localhost:4021** in your browser.

### 4. Getting a World ID App ID

1. Go to [developer.worldcoin.org](https://developer.worldcoin.org)
2. Sign in through World App (or create an account)
3. Click **New App**
4. Set **App Name**: `AgeGate`
5. Add an **Action**: `verify-age`, verification level: `Orb`
6. Copy your **App ID** (format: `app_xxxx...`)
7. Add it to `.env` as `WORLD_APP_ID`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AgeGate Server                        │
│                      (Hono, port 4021)                       │
│                                                             │
│  GET  /              → public/index.html (landing page)     │
│  GET  /health        → { status: 'ok' }                     │
│  POST /verify-age    → World ID proof verification          │
│  GET  /content       → x402 + AgentKit protected endpoint   │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │  World ID    │  │   AgentKit    │  │    x402 / USDC   │ │
│  │  ZK Proof    │  │  Free-trial   │  │  World Chain 480 │ │
│  │  Orb level   │  │  3 uses/agent │  │  Base 8453       │ │
│  └──────────────┘  └───────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  developer.worldcoin   World AgentBook    x402 Facilitator
  .org/api/v2/verify    (on-chain)         (World Chain)
```

### Key packages

| Package | Role |
|---|---|
| `hono` | HTTP server framework |
| `@hono/node-server` | Node.js adapter for Hono |
| `@worldcoin/agentkit` | AI agent verification (AgentKit) |
| `@x402/hono` | x402 payment middleware |
| `@x402/core` | x402 facilitator client |
| `@x402/evm` | EVM payment scheme (USDC) |

---

## Demo Mode

If `WORLD_APP_ID` is not configured, AgeGate runs in demo mode:

- `POST /verify-age` returns `{ verified: true, demo: true }` for any request
- Frontend shows **"⚡ Demo: Simulate Verification"** button
- Full UI flow works without World App

Perfect for hackathon demos without a live World ID integration.

---

## Built For

**Coinbase × World Hackathon** — March 26–29, 2026

> *Privacy-first age verification: no passports, no facial scans, no surveillance. Just a cryptographic yes or no.*

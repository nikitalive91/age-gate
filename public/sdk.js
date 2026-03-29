/**
 * AgeGate SDK — Drop-in age verification overlay
 *
 * Usage:
 *   <script src="https://agegate.dev/sdk.js"
 *     data-app-id="app_xxx"
 *     data-action="verify-age"
 *     data-server="https://agegate.dev">
 *   </script>
 *
 * The script blocks the page with a fullscreen overlay until the user
 * verifies their age via World ID. Credentials are cached in localStorage.
 *
 * Events:
 *   document.addEventListener('agegate:verified', e => e.detail.token)
 */
;(function () {
  'use strict'

  // ── Read config from script tag ────────────────────────────────────────────
  const scriptTag = document.currentScript
  if (!scriptTag) {
    console.error('[AgeGate SDK] Cannot find currentScript — was the SDK loaded dynamically?')
    return
  }

  const CONFIG = {
    appId:  scriptTag.getAttribute('data-app-id')  || '',
    action: scriptTag.getAttribute('data-action')   || 'verify-age',
    server: (scriptTag.getAttribute('data-server')  || '').replace(/\/$/, ''),
  }

  if (!CONFIG.server) {
    console.error('[AgeGate SDK] data-server attribute is required')
    return
  }

  const STORAGE_KEY = 'agegate_token'
  const ACCENT      = '#00d4aa'
  const BG_DARK     = '#0a0a0a'

  // ── SVG Logo (gate arch + checkmark) ───────────────────────────────────────
  const LOGO_SVG = `
    <svg width="100" height="100" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" rx="20" fill="#0d0d0d"/>
      <path d="M19 40 Q19 15 40 15 Q61 15 61 40" stroke="${ACCENT}" stroke-width="8" fill="none" stroke-linecap="round"/>
      <rect x="15" y="37" width="9" height="24" rx="3" fill="${ACCENT}"/>
      <rect x="56" y="37" width="9" height="24" rx="3" fill="${ACCENT}"/>
      <path d="M29 51 L37 59 L53 41" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`

  // ── Check for existing valid credential ────────────────────────────────────
  function getStoredToken() {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  }

  function storeToken(token) {
    try { localStorage.setItem(STORAGE_KEY, token) } catch { /* ignore */ }
  }

  async function validateToken(token) {
    try {
      const res = await fetch(CONFIG.server + '/content', {
        headers: { 'Authorization': 'Bearer ' + token },
      })
      return res.ok
    } catch {
      // Network error — assume valid to avoid blocking on flaky connections
      return true
    }
  }

  // ── Create overlay ─────────────────────────────────────────────────────────
  function createOverlay() {
    const overlay = document.createElement('div')
    overlay.id = 'agegate-overlay'
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: ${BG_DARK};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      text-align: center;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `

    overlay.innerHTML = `
      <div style="margin-bottom:28px">${LOGO_SVG}</div>

      <h1 style="
        font-size: 28px;
        font-weight: 800;
        margin: 0 0 12px;
        letter-spacing: -0.5px;
        line-height: 1.2;
      ">Age verification required</h1>

      <p style="
        font-size: 15px;
        color: #888;
        margin: 0 0 36px;
        max-width: 380px;
        line-height: 1.5;
      ">Powered by <span style="color:${ACCENT};font-weight:600">AgeGate</span> — zero-knowledge proof, no data shared</p>

      <button id="agegate-verify-btn" style="
        background: ${ACCENT};
        color: #000;
        border: none;
        padding: 16px 40px;
        font-size: 17px;
        font-weight: 700;
        border-radius: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        box-shadow: 0 0 30px rgba(0,212,170,0.25);
      ">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="#000" stroke-width="2.5"/>
          <circle cx="16" cy="16" r="6" stroke="#000" stroke-width="2.5"/>
          <line x1="16" y1="2" x2="16" y2="8" stroke="#000" stroke-width="2"/>
          <line x1="16" y1="24" x2="16" y2="30" stroke="#000" stroke-width="2"/>
        </svg>
        Verify with World ID
      </button>

      <p style="
        font-size: 12px;
        color: #555;
        margin-top: 40px;
        max-width: 320px;
        line-height: 1.5;
      ">Your identity is never shared. AgeGate uses World ID zero-knowledge proofs to verify age without revealing personal data.</p>
    `

    document.body.appendChild(overlay)

    // Fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
    })

    // Button hover effects
    const btn = overlay.querySelector('#agegate-verify-btn')
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.04)'
      btn.style.boxShadow = '0 0 50px rgba(0,212,170,0.4)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)'
      btn.style.boxShadow = '0 0 30px rgba(0,212,170,0.25)'
    })

    // Click — open verification popup
    btn.addEventListener('click', openVerifyPopup)

    return overlay
  }

  // ── Open verification popup ────────────────────────────────────────────────
  function openVerifyPopup() {
    const w = 480
    const h = 640
    const left = (screen.width - w) / 2
    const top  = (screen.height - h) / 2
    const url  = CONFIG.server + '/verify.html'

    const popup = window.open(
      url,
      'agegate-verify',
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,status=no,scrollbars=no`
    )

    if (!popup) {
      // Popup blocked — fall back to redirect approach
      window.location.href = url + '?redirect=' + encodeURIComponent(window.location.href)
    }
  }

  // ── Listen for postMessage from verify popup ──────────────────────────────
  window.addEventListener('message', function (e) {
    // Validate origin
    if (CONFIG.server && e.origin !== new URL(CONFIG.server).origin) return

    if (e.data && e.data.type === 'agegate-verified' && e.data.token) {
      const token = e.data.token
      storeToken(token)
      removeOverlay()
      dispatchVerified(token)
      console.log('[AgeGate SDK] Verification successful')
    }
  })

  // ── Remove overlay with fade ───────────────────────────────────────────────
  function removeOverlay() {
    const overlay = document.getElementById('agegate-overlay')
    if (!overlay) return
    overlay.style.opacity = '0'
    setTimeout(() => overlay.remove(), 300)
  }

  // ── Dispatch custom event ──────────────────────────────────────────────────
  function dispatchVerified(token) {
    document.dispatchEvent(new CustomEvent('agegate:verified', { detail: { token } }))
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    const token = getStoredToken()

    if (token) {
      const valid = await validateToken(token)
      if (valid) {
        dispatchVerified(token)
        console.log('[AgeGate SDK] Existing credential valid')
        return
      }
      // Token expired or invalid — clear and show overlay
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }

    // No valid credential — show overlay
    if (document.body) {
      createOverlay()
    } else {
      document.addEventListener('DOMContentLoaded', createOverlay)
    }
  }

  // Wait for DOM to be ready enough to append overlay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

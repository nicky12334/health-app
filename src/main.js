// App entry: navigation, scanner lifecycle and wiring the modules to the UI.

import './style.css'
import { addEntry, deleteEntry, todayKey } from './storage.js'
import { saveProfile, hasProfile } from './profile.js'
import { parseQuickAdd } from './quickadd.js'
import { lookupBarcode, scaleNutrition } from './nutrition.js'
import { Scanner, cameraSupported, isSecureForCamera } from './scanner.js'
import {
  renderToday,
  renderHistory,
  renderProfile,
  renderScanScaffold,
  renderScanResult
} from './ui.js'

const screenEl = document.getElementById('screen')
const navButtons = Array.from(document.querySelectorAll('.nav-btn'))

const scanner = new Scanner()
let current = null
let scanBusy = false
let lastBarcode = null

// Action API handed to the UI renderers.
const api = {
  navigate: show,
  refresh: () => render(current),

  addQuickAdd(text) {
    const entry = parseQuickAdd(text)
    if (!entry) return false
    addEntry(entry)
    return true
  },

  deleteEntry(id) {
    deleteEntry(id)
  },

  saveProfile(profile) {
    saveProfile(profile)
    show('today')
  },

  addProduct(product, grams) {
    addEntry(scaleNutrition(product, grams))
    show('today')
  }
}

function render(name) {
  if (name === 'today') renderToday(screenEl, api)
  else if (name === 'history') renderHistory(screenEl)
  else if (name === 'profile') renderProfile(screenEl, api)
  else if (name === 'scan') startScan()
}

function show(name) {
  // Leaving the scan screen: release the camera.
  if (current === 'scan' && name !== 'scan') scanner.stop()
  current = name
  navButtons.forEach((b) => b.classList.toggle('active', b.dataset.screen === name))
  render(name)
}

// ---- Scan screen orchestration --------------------------------------------

function startScan() {
  const { videoEl, statusEl, resultEl } = renderScanScaffold(screenEl)
  lastBarcode = null

  if (!cameraSupported()) {
    statusEl.textContent = 'This browser has no camera access.'
    return
  }
  if (!isSecureForCamera()) {
    statusEl.innerHTML =
      'Camera needs HTTPS. Open the deployed (https) URL on your phone — see the README.'
    return
  }

  scanner.start(
    videoEl,
    async (barcode) => {
      // Debounce repeated reads of the same code while we resolve one.
      if (scanBusy || barcode === lastBarcode) return
      lastBarcode = barcode
      scanBusy = true
      statusEl.textContent = `Looking up ${barcode}…`
      try {
        const product = await lookupBarcode(barcode)
        if (current !== 'scan') return // user navigated away mid-request
        statusEl.textContent = product.found
          ? 'Found! Set a portion and add it.'
          : 'Not found — try Quick add.'
        renderScanResult(resultEl, product, api)
      } catch (err) {
        statusEl.textContent = `Lookup failed: ${err.message}`
      } finally {
        scanBusy = false
        // Allow re-scanning the same item after a short pause.
        setTimeout(() => {
          if (lastBarcode === barcode) lastBarcode = null
        }, 2500)
      }
    },
    (err) => {
      statusEl.textContent = `Camera error: ${err?.message || err}. Grant camera permission and retry.`
    }
  )
}

// ---- boot ------------------------------------------------------------------

navButtons.forEach((b) => b.addEventListener('click', () => show(b.dataset.screen)))

// Start on Profile the first time (so a goal exists), otherwise Today.
show(hasProfile() ? 'today' : 'profile')

// Expose the current day key for quick console debugging.
window.__nt = { todayKey }

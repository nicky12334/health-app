// Barcode scanning via ZXing.
//
// Wraps BrowserMultiFormatReader, points it at the rear camera and reports the first
// decoded barcode. Designed to be started when the Scan screen opens and stopped when
// it closes so the camera light goes off and the stream is released.

import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

// Restrict to the 1D formats found on packaged food — faster, fewer misreads.
function buildHints() {
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128
  ])
  return hints
}

export class Scanner {
  constructor() {
    this.reader = new BrowserMultiFormatReader(buildHints())
    this.controls = null
    this.running = false
  }

  // videoEl: a <video> element. onResult(barcode): called once per detected code.
  // onError(err): optional, called if the camera can't start.
  async start(videoEl, onResult, onError) {
    if (this.running) return
    this.running = true
    try {
      this.controls = await this.reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoEl,
        (result, err, controls) => {
          if (result) {
            onResult(result.getText())
          }
          // Non-fatal per-frame "not found" errors are ignored by design.
          void err
          void controls
        }
      )
    } catch (err) {
      this.running = false
      if (onError) onError(err)
      else throw err
    }
  }

  stop() {
    this.running = false
    if (this.controls) {
      this.controls.stop()
      this.controls = null
    }
  }
}

// Camera support requires a secure context (HTTPS) or localhost.
export function cameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

export function isSecureForCamera() {
  return window.isSecureContext || location.hostname === 'localhost'
}

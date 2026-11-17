import { invoke } from '@tauri-apps/api/core'

// Tauri v2 injects __TAURI_INTERNALS__ into every webview; `window.__TAURI__`
// only exists when `withGlobalTauri` is enabled, so don't rely on it.
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function browserDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

/** Pick and read a session file. Resolves to its text, or null if cancelled. */
export async function openSession() {
  if (isTauri) return invoke('open_session')
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.algo'
    input.onchange = async () => resolve(input.files[0] ? await input.files[0].text() : null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Export a PNG data URL. Resolves to the saved path, or null if cancelled. */
export async function exportPng(dataUrl) {
  if (isTauri) return invoke('export_png', { dataUrl })
  browserDownload(dataUrl, 'code-voice-sketch.png')
  return null
}

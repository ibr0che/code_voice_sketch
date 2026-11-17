import { paintPreview } from './structures'

// Pointer-based drag and drop for data structures. (HTML5 drag-and-drop is
// unreliable inside Tauri's Windows webview, and this is easy to control.)
//
// A press on a source either becomes a click (no movement) or a drag: a ghost
// image follows the cursor and, on release, a DROP_EVENT is dispatched on
// `window`. The canvas listens for it and sets `detail.handled = true` if the
// drop landed on the page.

export const DROP_EVENT = 'codevoicesketch:drop'
const DRAG_THRESHOLD = 5

/**
 * @param e          the pointerdown event
 * @param getObject  () => object to drag (called when the drag starts)
 * @param opts.onClick   called if the press never turned into a drag
 * @param opts.onDragStart / onDragEnd(handled)
 */
export function pressToDrag(e, getObject, { onClick, onDragStart, onDragEnd } = {}) {
  if (e.button !== 0) return
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  let ghost = null
  let size = null
  let obj = null

  const place = (ev) => {
    ghost.style.transform = `translate(${ev.clientX - size.w / 2}px, ${ev.clientY - size.h / 2}px)`
  }

  const move = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
      obj = getObject()
      ghost = document.createElement('canvas')
      size = paintPreview(ghost, obj)
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        pointerEvents: 'none',
        opacity: '0.85',
        zIndex: '10000',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
      })
      document.body.appendChild(ghost)
      document.body.style.cursor = 'grabbing'
      onDragStart?.()
    }
    place(ev)
  }

  const up = (ev) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    if (!ghost) {
      onClick?.()
      return
    }
    ghost.remove()
    document.body.style.cursor = ''
    const detail = {
      obj,
      // client coordinates of where the object's top-left corner should land
      left: ev.clientX - size.w / 2 + size.pad,
      top: ev.clientY - size.h / 2 + size.pad,
      handled: false,
    }
    window.dispatchEvent(new CustomEvent(DROP_EVENT, { detail }))
    onDragEnd?.(detail.handled)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

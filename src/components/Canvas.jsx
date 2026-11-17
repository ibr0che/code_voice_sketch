import React, { useRef, useEffect, useState, useImperativeHandle } from 'react'
import useStore, { TOOLS } from '../stores/useStore'
import { drawObject, bounds, hitTest } from '../lib/structures'
import { DROP_EVENT } from '../lib/drag'
import styles from './Canvas.module.css'

const SELECTION_COLOR = '#818cf8'
const PAGE_BG = '#0d0d0f'

const contains = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
const normRect = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
})

function drawArrow(ctx, x1, y1, x2, y2, size) {
  const head = 10 + size * 2
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

export default function Canvas({ ref }) {
  const pageRef = useRef(null)
  const canvasRef = useRef(null)   // bitmap: pen, shapes, text
  const overlayRef = useRef(null)  // data-structure objects + selection box
  const textInputRef = useRef(null)

  const gesture = useRef(null)     // in-progress pointer gesture
  const snapshotRef = useRef(null) // bitmap before a shape drag started
  const appliedImage = useRef(null) // last bitmap we know is on the canvas
  const floating = useRef(null)    // lifted pixels while a selection is dragged
  const marquee = useRef(null)     // rubber-band rectangle while dragging
  const textPos = useRef(null)
  const textCommitted = useRef(false)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [textInput, setTextInput] = useState(null) // {x, y} while a text box is open

  const activeTool = useStore((s) => s.activeTool)
  const objects = useStore((s) => s.objects)
  const selectedIds = useStore((s) => s.selectedIds)
  const bitmapSel = useStore((s) => s.bitmapSel)
  const history = useStore((s) => s.history)
  const historyIndex = useStore((s) => s.historyIndex)
  const activeColor = useStore((s) => s.activeColor)
  const brushSize = useStore((s) => s.brushSize)

  const getCtx = () => canvasRef.current?.getContext('2d')

  // getImageData throws on a zero-sized canvas, so return null instead
  const captureImage = () => {
    const c = canvasRef.current
    if (!c || !c.width || !c.height) return null
    return getCtx().getImageData(0, 0, c.width, c.height)
  }

  const commitBitmap = (objectsOverride) => {
    const image = captureImage()
    if (!image) return
    appliedImage.current = image
    useStore.getState().commitImage(image, objectsOverride)
  }

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    const page = pageRef.current

    const resize = () => {
      const w = page.clientWidth
      const h = page.clientHeight
      // Hidden or not laid out yet: keep the current bitmap. Resizing to 0
      // would wipe the drawing and make getImageData throw.
      if (!w || !h) return
      if (w === canvas.width && h === canvas.height) return

      const ctx = canvas.getContext('2d')
      const prev = canvas.width && canvas.height
        ? ctx.getImageData(0, 0, canvas.width, canvas.height)
        : null
      canvas.width = w
      canvas.height = h
      overlay.width = w
      overlay.height = h
      if (prev) ctx.putImageData(prev, 0, 0)
      setSize({ w, h })
      useStore.getState().setCanvasSize({ w, h })

      // Seed history with the blank page so the first change can be undone
      if (useStore.getState().history.length === 0) commitBitmap()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(page)
    return () => ro.disconnect()
  }, [])

  // ── Undo / redo: restore the bitmap for the current history entry ──────────

  useEffect(() => {
    const image = history[historyIndex]?.image
    if (image && image !== appliedImage.current) {
      getCtx()?.putImageData(image, 0, 0)
      appliedImage.current = image
    }
  }, [history, historyIndex])

  // ── Objects + selection layer ──────────────────────────────────────────────

  const redrawOverlay = () => {
    const overlay = overlayRef.current
    if (!overlay?.width) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    const { objects, selectedIds, bitmapSel } = useStore.getState()

    // pixels lifted by a selection drag sit under the structures
    if (floating.current) ctx.drawImage(floating.current.canvas, floating.current.x, floating.current.y)
    for (const obj of objects) drawObject(ctx, obj)

    ctx.save()
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 3])
    for (const obj of objects) {
      if (!selectedIds.includes(obj.id)) continue
      const b = bounds(obj)
      ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10)
    }
    if (bitmapSel) ctx.strokeRect(bitmapSel.x + 0.5, bitmapSel.y + 0.5, bitmapSel.w, bitmapSel.h)
    if (marquee.current) {
      const m = marquee.current
      ctx.fillStyle = 'rgba(99, 102, 241, 0.12)'
      ctx.fillRect(m.x, m.y, m.w, m.h)
      ctx.strokeRect(m.x + 0.5, m.y + 0.5, m.w, m.h)
    }
    ctx.restore()
  }

  useEffect(redrawOverlay, [objects, selectedIds, bitmapSel, size])

  const objectAt = (pos) => {
    const all = useStore.getState().objects
    for (let i = all.length - 1; i >= 0; i--) {
      if (hitTest(all[i], pos.x, pos.y)) return all[i]
    }
    return null
  }

  // Dropping a structure (from the ribbon or the editor) onto the page
  useEffect(() => {
    const onDrop = (e) => {
      const { obj, left, top, center } = e.detail
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const b = bounds({ ...obj, x: 0, y: 0 })
      let x
      let y
      if (center) {
        const n = useStore.getState().objects.length
        x = (rect.width - b.w) / 2 + (n % 5) * 20
        y = (rect.height - b.h) / 2 + (n % 5) * 20
      } else {
        x = left - rect.left
        y = top - rect.top
        // Only count the drop if the structure's centre is over the page
        const cx = x + b.w / 2
        const cy = y + b.h / 2
        if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return
      }
      x = Math.max(0, Math.min(x, rect.width - b.w))
      y = Math.max(0, Math.min(y, rect.height - b.h))
      useStore.getState().addObject({ ...obj, x: Math.round(x), y: Math.round(y) })
      e.detail.handled = true
    }
    window.addEventListener(DROP_EVENT, onDrop)
    return () => window.removeEventListener(DROP_EVENT, onDrop)
  }, [])

  // ── Pointer handling ───────────────────────────────────────────────────────

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const pos = getPos(e)
    const tool = useStore.getState().activeTool

    // The text tool places its box on pointer *up*; opening it now would let
    // the browser's mousedown focus change close it again straight away.
    if (tool === TOOLS.TEXT) return

    e.currentTarget.setPointerCapture(e.pointerId)

    if (tool === TOOLS.SELECT) {
      const st = useStore.getState()
      const hit = objectAt(pos)
      const onSelection = (st.bitmapSel && contains(st.bitmapSel, pos)) || (hit && st.selectedIds.includes(hit.id))

      if (!onSelection && hit) st.setSelection([hit.id], null)
      else if (!onSelection) st.setSelection([], null)

      if (onSelection || hit) {
        // grab whatever is selected and drag it as one piece
        const cur = useStore.getState()
        gesture.current = {
          kind: 'move',
          start: pos,
          origins: Object.fromEntries(cur.objects.filter((o) => cur.selectedIds.includes(o.id)).map((o) => [o.id, { x: o.x, y: o.y }])),
          rect0: cur.bitmapSel,
          lifted: false,
          moved: false,
        }
      } else {
        gesture.current = { kind: 'marquee', start: pos }
      }
      return
    }

    const { activeColor, brushSize } = useStore.getState()
    const ctx = getCtx()
    ctx.strokeStyle = activeColor
    ctx.fillStyle = activeColor
    ctx.lineWidth = tool === TOOLS.ERASER ? brushSize * 4 + 6 : brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = tool === TOOLS.ERASER ? 'destination-out' : 'source-over'

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      gesture.current = { kind: 'freehand', last: pos }
      // a click without movement still leaves a dot
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(pos.x + 0.01, pos.y)
      ctx.stroke()
    } else {
      gesture.current = { kind: 'shape', start: pos, moved: false }
      snapshotRef.current = captureImage()
    }
  }

  const onPointerMove = (e) => {
    const pos = getPos(e)
    useStore.getState().setCursor(pos)
    const g = gesture.current

    if (!g) {
      // hover feedback for the select tool
      if (useStore.getState().activeTool === TOOLS.SELECT) {
        const st = useStore.getState()
        const grab = objectAt(pos) || (st.bitmapSel && contains(st.bitmapSel, pos))
        canvasRef.current.style.cursor = grab ? 'move' : 'crosshair'
      }
      return
    }

    if (g.kind === 'marquee') {
      marquee.current = normRect(g.start, pos)
      redrawOverlay()
      return
    }

    if (g.kind === 'move') {
      const dx = Math.round(pos.x - g.start.x)
      const dy = Math.round(pos.y - g.start.y)
      if (!g.moved && Math.hypot(dx, dy) < 3) return // ignore click jitter
      g.moved = true

      // first real movement: lift the selected pixels off the bitmap
      if (g.rect0 && !g.lifted) {
        const c = canvasRef.current
        const x = Math.max(0, Math.round(g.rect0.x))
        const y = Math.max(0, Math.round(g.rect0.y))
        const w = Math.min(c.width - x, Math.round(g.rect0.w))
        const h = Math.min(c.height - y, Math.round(g.rect0.h))
        if (w > 0 && h > 0) {
          const lift = document.createElement('canvas')
          lift.width = w
          lift.height = h
          lift.getContext('2d').putImageData(getCtx().getImageData(x, y, w, h), 0, 0)
          getCtx().clearRect(x, y, w, h)
          floating.current = { canvas: lift, x, y, x0: x, y0: y }
        }
        g.lifted = true
      }
      if (floating.current) {
        floating.current.x = floating.current.x0 + dx
        floating.current.y = floating.current.y0 + dy
      }

      const s = useStore.getState()
      s.setObjectsLive(s.objects.map((o) => (
        g.origins[o.id] ? { ...o, x: g.origins[o.id].x + dx, y: g.origins[o.id].y + dy } : o
      )))
      if (g.rect0) s.setSelection(s.selectedIds, { ...g.rect0, x: g.rect0.x + dx, y: g.rect0.y + dy })
      redrawOverlay()
      return
    }

    const ctx = getCtx()
    if (g.kind === 'freehand') {
      ctx.beginPath()
      ctx.moveTo(g.last.x, g.last.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      g.last = pos
      return
    }

    // shape: redraw from the snapshot on every move
    if (pos.x !== g.start.x || pos.y !== g.start.y) g.moved = true
    if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0)
    const { x, y } = g.start
    const { activeColor, brushSize, activeTool } = useStore.getState()
    ctx.strokeStyle = activeColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'source-over'

    switch (activeTool) {
      case TOOLS.LINE:
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        break
      case TOOLS.ARROW:
        drawArrow(ctx, x, y, pos.x, pos.y, brushSize)
        break
      case TOOLS.RECT:
        ctx.strokeRect(x, y, pos.x - x, pos.y - y)
        break
      case TOOLS.ELLIPSE:
        ctx.beginPath()
        ctx.ellipse((x + pos.x) / 2, (y + pos.y) / 2, Math.abs(pos.x - x) / 2, Math.abs(pos.y - y) / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
        break
    }
  }

  const onPointerUp = (e) => {
    const tool = useStore.getState().activeTool

    if (tool === TOOLS.TEXT) {
      if (e.button !== 0) return
      textPos.current = getPos(e)
      textCommitted.current = false
      setTextInput(textPos.current)
      return
    }

    // Apply the release position too: move events can be sparse (fast flicks),
    // and the gesture should end exactly where the pointer was let go.
    if (gesture.current && e.type === 'pointerup') onPointerMove(e)

    const g = gesture.current
    gesture.current = null
    if (!g) return

    if (g.kind === 'marquee') {
      const rect = marquee.current
      marquee.current = null
      finishMarquee(rect)
      return
    }

    if (g.kind === 'move') {
      if (g.moved) {
        if (floating.current) {
          // put the lifted pixels down at their new position
          getCtx().drawImage(floating.current.canvas, floating.current.x, floating.current.y)
          floating.current = null
          commitBitmap()
        } else {
          useStore.getState().commitObjects(useStore.getState().objects)
        }
      }
      return
    }

    const ctx = getCtx()
    ctx.globalCompositeOperation = 'source-over'
    snapshotRef.current = null
    if (g.kind === 'shape' && !g.moved) return
    commitBitmap()
  }

  // Turn a dragged rectangle into a selection: structures it touches, plus
  // the drawn pixels inside it (if there are any).
  const finishMarquee = (rect) => {
    const st = useStore.getState()
    const c = canvasRef.current
    if (!rect || rect.w < 4 || rect.h < 4) { st.clearSelection(); redrawOverlay(); return }

    const x = Math.max(0, Math.round(rect.x))
    const y = Math.max(0, Math.round(rect.y))
    const w = Math.min(c.width - x, Math.round(rect.w))
    const h = Math.min(c.height - y, Math.round(rect.h))
    const ids = st.objects.filter((o) => intersects(bounds(o), rect)).map((o) => o.id)

    let hasPixels = false
    if (w > 0 && h > 0) {
      const data = getCtx().getImageData(x, y, w, h).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) { hasPixels = true; break }
      }
    }
    st.setSelection(ids, hasPixels ? { x, y, w, h } : null)
    redrawOverlay()
  }

  const onDoubleClick = (e) => {
    if (useStore.getState().activeTool !== TOOLS.SELECT) return
    const hit = objectAt(getPos(e))
    if (hit) useStore.getState().openEditor(hit.type, hit.id)
  }

  // ── Text tool ──────────────────────────────────────────────────────────────

  const commitText = (text) => {
    // Enter and the blur it causes both land here; only commit once per box
    if (textCommitted.current) return
    textCommitted.current = true
    const pos = textPos.current
    setTextInput(null)
    if (!text.trim() || !pos) return
    const { activeColor, brushSize } = useStore.getState()
    const ctx = getCtx()
    ctx.font = `${brushSize * 5 + 10}px 'JetBrains Mono', monospace`
    ctx.fillStyle = activeColor
    ctx.globalCompositeOperation = 'source-over'
    // Match where the text sits inside the input box (4px / 2px padding)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(text, pos.x + 4, pos.y + 2)
    commitBitmap()
  }

  // Switching tools abandons (commits) an open text box
  useEffect(() => {
    if (activeTool !== TOOLS.TEXT && textInputRef.current) commitText(textInputRef.current.value)
  }, [activeTool])

  // ── API for the parent (file actions live in App) ──────────────────────────

  useImperativeHandle(ref, () => ({
    clear: () => {
      const c = canvasRef.current
      if (!c.width) return
      getCtx().clearRect(0, 0, c.width, c.height)
      useStore.getState().clearSelection()
      commitBitmap([])
    },
    /** Delete whatever the Select tool has picked up (pixels and structures). */
    deleteSelection: () => {
      const st = useStore.getState()
      if (!st.bitmapSel && !st.selectedIds.length) return
      const remaining = st.objects.filter((o) => !st.selectedIds.includes(o.id))
      const sel = st.bitmapSel
      st.clearSelection()
      if (sel) {
        getCtx().clearRect(sel.x, sel.y, sel.w, sel.h)
        commitBitmap(remaining)
      } else {
        st.commitObjects(remaining)
      }
    },
    selectAll: () => {
      const c = canvasRef.current
      const st = useStore.getState()
      st.setActiveTool(TOOLS.SELECT)
      st.setSelection(st.objects.map((o) => o.id), c.width ? { x: 0, y: 0, w: c.width, h: c.height } : null)
    },
    /** Page as a PNG: dark background, bitmap, then structures on top. */
    exportPNG: () => {
      const c = canvasRef.current
      if (!c.width) return null
      const out = document.createElement('canvas')
      out.width = c.width
      out.height = c.height
      const ctx = out.getContext('2d')
      ctx.fillStyle = PAGE_BG
      ctx.fillRect(0, 0, out.width, out.height)
      ctx.drawImage(c, 0, 0)
      for (const obj of useStore.getState().objects) drawObject(ctx, obj)
      return out.toDataURL('image/png')
    },
    /** Just the pen/shape layer (transparent), for saving sessions. */
    bitmapDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
    /** Replace the bitmap with an image (used when opening a session). */
    loadBitmap: (dataURL, objects) => new Promise((resolve) => {
      const finish = () => { commitBitmap(objects); resolve() }
      if (!dataURL) {
        const c = canvasRef.current
        getCtx().clearRect(0, 0, c.width, c.height)
        return finish()
      }
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        const ctx = getCtx()
        ctx.clearRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0)
        finish()
      }
      img.onerror = finish
      img.src = dataURL
    }),
  }), [])

  const cursor = activeTool === TOOLS.TEXT ? 'text'
    : activeTool === TOOLS.ERASER ? 'cell'
    : activeTool === TOOLS.SELECT ? 'default'
    : 'crosshair'

  return (
    <div className={styles.workspace}>
      <div className={styles.page} ref={pageRef}>
        <canvas
          ref={canvasRef}
          className={styles.layer}
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => useStore.getState().setCursor(null)}
          onDoubleClick={onDoubleClick}
        />
        <canvas ref={overlayRef} className={styles.layer} style={{ pointerEvents: 'none' }} />

        {textInput && (
          <input
            key={`${textInput.x},${textInput.y}`}
            ref={textInputRef}
            autoFocus
            className={styles.textInput}
            style={{
              left: textInput.x,
              top: textInput.y,
              color: activeColor,
              fontSize: brushSize * 5 + 10,
              lineHeight: 1,
            }}
            placeholder="type here…"
            onKeyDown={(e) => {
              // Keep these from reaching the global shortcut handler: the box
              // unmounts mid-keypress, which would make Enter look unfocused.
              if (e.key === 'Enter') { e.stopPropagation(); commitText(e.target.value) }
              if (e.key === 'Escape') { e.stopPropagation(); textCommitted.current = true; setTextInput(null) }
            }}
            onBlur={(e) => commitText(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

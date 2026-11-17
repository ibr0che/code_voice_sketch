import React, { useEffect, useRef } from 'react'
import useStore, { TOOLS } from './stores/useStore'
import { openSession, exportPng } from './lib/files'
import Ribbon from './components/Ribbon'
import Canvas from './components/Canvas'
import StatusBar from './components/StatusBar'
import StructureEditor from './components/StructureEditor'
import styles from './App.module.css'

// Single-key tool shortcuts (no modifier)
const TOOL_KEYS = {
  v: TOOLS.SELECT,
  p: TOOLS.PEN,
  e: TOOLS.ERASER,
  l: TOOLS.LINE,
  a: TOOLS.ARROW,
  r: TOOLS.RECT,
  o: TOOLS.ELLIPSE,
  t: TOOLS.TEXT,
}

export default function App() {
  const canvasRef = useRef(null)

  // ── File operations ─────────────────────────────────────────────────────────

  // Save writes the page as a PNG (dark background, drawing + structures)
  const handleSave = async () => {
    const dataURL = canvasRef.current?.exportPNG()
    if (dataURL) await exportPng(dataURL)
  }

  const handleOpen = async () => {
    const text = await openSession()
    if (!text) return
    let session
    try {
      session = JSON.parse(text)
    } catch {
      console.error('Not a valid Code Voice Sketch session file')
      return
    }
    // Older (v1) sessions kept structures in separate panels; only their
    // drawing carries over.
    const objects = Array.isArray(session.objects) ? session.objects : []
    useStore.getState().clearSelection()
    await canvasRef.current?.loadBitmap(session.bitmap ?? session.canvasDataURL ?? null, objects)
  }

  const handleClear = () => canvasRef.current?.clear()
  const handleDelete = () => canvasRef.current?.deleteSelection()

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // Handlers read from a ref / getState(), so the listener is registered once.

  const actions = useRef({})
  actions.current = { handleSave, handleOpen, handleClear, handleDelete }

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      const store = useStore.getState()
      if (store.editor) return // the structure editor dialog is open

      const key = e.key.toLowerCase()

      if (e.ctrlKey || e.metaKey) {
        const ctrlActions = {
          z: () => (e.shiftKey ? store.redo() : store.undo()),
          y: store.redo,
          d: actions.current.handleClear,
          a: () => canvasRef.current?.selectAll(),
          s: actions.current.handleSave,
          o: actions.current.handleOpen,
        }
        if (ctrlActions[key]) {
          e.preventDefault()
          ctrlActions[key]()
        }
        return
      }
      if (e.altKey) return

      if (key === 'delete' || key === 'backspace') actions.current.handleDelete()
      else if (key === 'escape') store.clearSelection()
      else if (key === 'enter' && store.activeTool === TOOLS.SELECT && store.selectedIds.length === 1 && !store.bitmapSel) {
        const sel = store.objects.find((o) => o.id === store.selectedIds[0])
        if (sel) store.openEditor(sel.type, sel.id)
      } else if (TOOL_KEYS[key]) store.setActiveTool(TOOL_KEYS[key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Layout ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.app}>
      <Ribbon onClear={handleClear} onDelete={handleDelete} onOpen={handleOpen} onSave={handleSave} />
      <Canvas ref={canvasRef} />
      <StatusBar />
      <StructureEditor />
    </div>
  )
}

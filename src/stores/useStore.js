import { create } from 'zustand'

export const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  ERASER: 'eraser',
  LINE: 'line',
  ARROW: 'arrow',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
}

export const COLORS = [
  '#e8e8f0', // white
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // yellow
  '#22d3a0', // green
  '#60a5fa', // blue
  '#a78bfa', // purple
  '#f472b6', // pink
  '#6366f1', // indigo
  '#0d0d0f', // black
]

const MAX_HISTORY = 50

let idCounter = 0
export const newId = () => `obj${Date.now().toString(36)}${idCounter++}`

// Each history entry is a full snapshot of the page: the bitmap (pen strokes,
// shapes, text) plus the data-structure objects sitting on top of it.
function pushEntry(state, image, objects) {
  const history = state.history.slice(0, state.historyIndex + 1)
  history.push({ image, objects })
  const trimmed = history.slice(-MAX_HISTORY)
  return { history: trimmed, historyIndex: trimmed.length - 1, objects }
}

const currentImage = (s) => s.history[s.historyIndex]?.image ?? null

const NO_SELECTION = { selectedIds: [], bitmapSel: null }

const useStore = create((set, get) => ({
  // ── Tools ──────────────────────────────────────────────────────────────────
  activeTool: TOOLS.PEN,
  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
      // selection only makes sense while the Select tool is active
      ...(tool === TOOLS.SELECT ? {} : NO_SELECTION),
    })),

  activeColor: '#e8e8f0',
  setActiveColor: (color) => set({ activeColor: color }),

  brushSize: 3,
  setBrushSize: (size) => set({ brushSize: size }),

  // ── Status bar info ────────────────────────────────────────────────────────
  cursor: null, // {x, y} over the page, or null
  setCursor: (cursor) => set({ cursor }),
  canvasSize: { w: 0, h: 0 },
  setCanvasSize: (canvasSize) => set({ canvasSize }),

  // ── Page snapshots (undo / redo) ───────────────────────────────────────────
  history: [],
  historyIndex: -1,
  objects: [],

  /** Record a new bitmap state (after a stroke, shape, text, clear...). */
  commitImage: (image, objects) =>
    set((s) => pushEntry(s, image, objects ?? s.objects)),

  /** Record a new object list (after add / move / edit / delete). */
  commitObjects: (objects) =>
    set((s) => pushEntry(s, currentImage(s), objects)),

  /** Update objects without recording history (live dragging). */
  setObjectsLive: (objects) => set({ objects }),

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex > 0) {
      set({ historyIndex: historyIndex - 1, objects: history[historyIndex - 1].objects, ...NO_SELECTION })
    }
  },
  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex < history.length - 1) {
      set({ historyIndex: historyIndex + 1, objects: history[historyIndex + 1].objects, ...NO_SELECTION })
    }
  },

  // ── Selection ──────────────────────────────────────────────────────────────
  // The Select tool can pick up data structures (selectedIds) and a rectangle
  // of drawn pixels (bitmapSel: {x, y, w, h}); both move and delete together.
  selectedIds: [],
  bitmapSel: null,
  setSelection: (selectedIds, bitmapSel = null) => set({ selectedIds, bitmapSel }),
  clearSelection: () => set(NO_SELECTION),

  // ── Data-structure objects ─────────────────────────────────────────────────
  addObject: (obj) => {
    const s = get()
    s.commitObjects([...s.objects, obj])
    set({ selectedIds: [obj.id], bitmapSel: null, activeTool: TOOLS.SELECT })
  },
  updateObject: (id, patch) => {
    const s = get()
    s.commitObjects(s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  },

  // ── Structure editor dialog ────────────────────────────────────────────────
  // { type, id?: string } — `id` set when editing an existing object
  editor: null,
  openEditor: (type, id = null) => set({ editor: { type, id } }),
  closeEditor: () => set({ editor: null }),
}))

export default useStore

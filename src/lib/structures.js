import { newId } from '../stores/useStore'

// Data-structure objects live on the page as plain data:
//   { id, type, x, y, items: [{ v: 'text', c: '#hex' | null, l: 'label' }] }
// This module is the single place that knows how to lay them out and draw
// them, so the page, editor preview, drag ghost and PNG export all agree.

// Some structures carry options in `obj.opts`:
//   grid:  { cols }                 (items are row-major)
//   list:  { doubly, cycle }        (cycle = index the tail points back to, or -1)

export const STRUCTURES = {
  array: { label: 'Array', short: 'Array', defaults: [3, 1, 4, 1, 5, 9] },
  stack: { label: 'Stack', short: 'Stack', defaults: [1, 2, 3] },
  queue: { label: 'Queue', short: 'Queue', defaults: [1, 2, 3] },
  tree: { label: 'Binary Tree', short: 'Tree', defaults: [1, 2, 3, 4, 5, '', 6] },
  list: { label: 'Linked List', short: 'List', defaults: [1, 2, 3, 4] },
  heap: { label: 'Heap', short: 'Heap', defaults: [1, 3, 2, 7, 4, 5] },
  grid: { label: 'Grid', short: 'Grid', defaults: [1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1] },
}

export const HIGHLIGHTS = ['#f87171', '#fb923c', '#fbbf24', '#22d3a0', '#60a5fa', '#a78bfa']

export const makeItem = (v = '') => ({ v: String(v), c: null, l: '' })
export const defaultItems = (type) => STRUCTURES[type].defaults.map(makeItem)

export const defaultOpts = (type) => {
  if (type === 'grid') return { cols: 4 }
  if (type === 'list') return { doubly: false, cycle: -1 }
  return {}
}
/** Options with defaults filled in (older saved objects have no `opts`). */
export const optsOf = (obj) => ({ ...defaultOpts(obj.type), ...obj.opts })

export const createObject = (type, x = 0, y = 0, items, opts) => ({
  id: newId(),
  type,
  x,
  y,
  items: items ?? defaultItems(type),
  opts: opts ?? defaultOpts(type),
})

// ── Style ────────────────────────────────────────────────────────────────────

const FONT = "'JetBrains Mono', monospace"
const INK = '#e8e8f0'        // lines and text on the dark page
const MUTED = '#8888a8'
const LABEL = '#60a5fa'
const CELL_FILL = '#18181d'  // unhighlighted cell / node
const ON_HIGHLIGHT = '#0d0d0f' // text drawn over a highlight color
const CELL_H = 44
const MIN_CELL_W = 48
const LABEL_ROW = 24
const CAPTION_ROW = 18
const NODE_R = 22
const TREE_HGAP = 54
const TREE_VGAP = 68
const TREE_PAD = 10

// ── Layout (cached per object reference) ─────────────────────────────────────

const measureCtx = document.createElement('canvas').getContext('2d')
let cache = new WeakMap()

/** Call after web fonts load: cached widths were measured with a fallback font. */
export function invalidateLayouts() {
  cache = new WeakMap()
}

function textWidth(text, font) {
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

const isEmpty = (item) => {
  const v = item.v.trim().toLowerCase()
  return v === '' || v === 'null'
}

function layoutRow(obj) {
  const widths = obj.items.map((it) => Math.max(MIN_CELL_W, textWidth(it.v, `bold 16px ${FONT}`) + 20))
  const xs = []
  let x = 0
  for (const w of widths) { xs.push(x); x += w }
  const total = obj.items.length ? x : MIN_CELL_W
  return { w: total, h: LABEL_ROW + CELL_H + CAPTION_ROW, widths, xs }
}

function layoutStack(obj) {
  const cellW = Math.max(
    MIN_CELL_W,
    ...obj.items.map((it) => textWidth(it.v, `bold 16px ${FONT}`) + 20),
  )
  const rows = Math.max(1, obj.items.length)
  return { w: cellW + 84, h: rows * CELL_H + 8, cellW, rows }
}

function buildTree(items) {
  if (!items.length || isEmpty(items[0])) return null
  const node = (i) => ({ i, left: null, right: null })
  const root = node(0)
  const queue = [root]
  let k = 1
  while (queue.length && k < items.length) {
    const n = queue.shift()
    if (k < items.length && !isEmpty(items[k])) { n.left = node(k); queue.push(n.left) }
    k++
    if (k < items.length && !isEmpty(items[k])) { n.right = node(k); queue.push(n.right) }
    k++
  }
  return root
}

function layoutTree(obj) {
  return layoutTreeFrom(buildTree(obj.items))
}

function layoutTreeFrom(root) {
  if (!root) return { w: 120, h: 60, nodes: [], edges: [] }

  // In-order x gives every node its own column, so subtrees never overlap
  const nodes = []
  let column = 0
  let maxDepth = 0
  const walk = (n, depth) => {
    if (!n) return null
    const left = walk(n.left, depth + 1)
    const pos = { i: n.i, col: column++, depth }
    maxDepth = Math.max(maxDepth, depth)
    nodes.push(pos)
    const right = walk(n.right, depth + 1)
    pos.left = left
    pos.right = right
    return pos
  }
  walk(root, 0)

  const edges = []
  for (const p of nodes) {
    if (p.left) edges.push([p, p.left])
    if (p.right) edges.push([p, p.right])
  }
  const off = NODE_R + TREE_PAD
  for (const p of nodes) {
    p.x = off + p.col * TREE_HGAP
    p.y = off + p.depth * TREE_VGAP
  }
  return {
    w: off * 2 + (column - 1) * TREE_HGAP,
    h: off * 2 + maxDepth * TREE_VGAP + 12,
    nodes,
    edges,
  }
}

// Linked list: [value|*] -> [value|*] -> null, optionally doubly linked / cyclic
const LIST_NODE_H = 40
const LIST_PTR = 20
const LIST_GAP = 34
const LIST_NULL_W = 40

function layoutList(obj) {
  const { doubly, cycle } = optsOf(obj)
  const n = obj.items.length
  const valW = obj.items.map((it) => Math.max(30, textWidth(it.v, `bold 16px ${FONT}`) + 14))
  const nodeW = valW.map((w) => w + LIST_PTR * (doubly ? 2 : 1))
  const xs = []
  let x = 0
  for (const w of nodeW) { xs.push(x); x += w + LIST_GAP }
  const endX = n ? x - LIST_GAP : 0
  const hasCycle = n > 0 && cycle >= 0 && cycle < n
  const w = n ? (hasCycle ? endX : endX + LIST_GAP + LIST_NULL_W) : LIST_NULL_W
  const h = LABEL_ROW + LIST_NODE_H + (hasCycle ? 44 : 10)
  return { w, h, doubly, hasCycle, cycle, valW, nodeW, xs }
}

// Heap: the tree view (children of i are 2i+1 and 2i+2) above its backing array
const HEAP_CELL_H = 30
const HEAP_GAP = 18

function layoutHeap(obj) {
  const n = obj.items.length
  if (!n) return { w: 120, h: 60, nodes: [], edges: [] }
  const node = (i) => (i < n ? { i, left: node(2 * i + 1), right: node(2 * i + 2) } : null)
  const t = layoutTreeFrom(node(0))
  const cellW = Math.max(36, ...obj.items.map((it) => textWidth(it.v, `bold 14px ${FONT}`) + 14))
  const stripW = n * cellW
  const w = Math.max(t.w, stripW)
  return {
    w,
    h: t.h + HEAP_GAP + HEAP_CELL_H + 16,
    t,
    treeX: (w - t.w) / 2,
    stripX: (w - stripW) / 2,
    stripY: t.h + HEAP_GAP,
    cellW,
    n,
  }
}

// Grid: rows x cols table with row / column indices (items are row-major)
const GRID_CELL_H = 38
const GRID_IDX_W = 22
const GRID_IDX_H = 20

function layoutGrid(obj) {
  const cols = Math.max(1, Math.floor(optsOf(obj).cols) || 1)
  const rows = Math.max(1, Math.ceil(obj.items.length / cols))
  const cellW = Math.max(40, ...obj.items.map((it) => textWidth(it.v, `bold 15px ${FONT}`) + 16))
  return { w: GRID_IDX_W + cols * cellW, h: GRID_IDX_H + rows * GRID_CELL_H, cols, rows, cellW }
}

export function layoutObject(obj) {
  let l = cache.get(obj)
  if (!l) {
    if (obj.type === 'stack') l = layoutStack(obj)
    else if (obj.type === 'tree') l = layoutTree(obj)
    else if (obj.type === 'list') l = layoutList(obj)
    else if (obj.type === 'heap') l = layoutHeap(obj)
    else if (obj.type === 'grid') l = layoutGrid(obj)
    else l = layoutRow(obj)
    cache.set(obj, l)
  }
  return l
}

export function bounds(obj) {
  const { w, h } = layoutObject(obj)
  return { x: obj.x, y: obj.y, w, h }
}

export function hitTest(obj, px, py) {
  const b = bounds(obj)
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function drawCell(ctx, x, y, w, h, item, fontPx = 16, lineW = 2) {
  ctx.fillStyle = item.c || CELL_FILL
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = INK
  ctx.lineWidth = lineW
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = item.c ? ON_HIGHLIGHT : INK
  ctx.font = `bold ${fontPx}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(item.v, x + w / 2, y + h / 2 + 1)
}

function drawPointerLabel(ctx, text, cx) {
  ctx.fillStyle = LABEL
  ctx.font = `bold 13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, 8)
  // small arrow pointing down at the cell
  ctx.beginPath()
  ctx.moveTo(cx - 4, 16)
  ctx.lineTo(cx + 4, 16)
  ctx.lineTo(cx, 22)
  ctx.closePath()
  ctx.fill()
}

function drawCaption(ctx, text, cx) {
  ctx.fillStyle = MUTED
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, LABEL_ROW + CELL_H + 10)
}

function drawRow(ctx, obj, l) {
  const isQueue = obj.type === 'queue'
  if (!obj.items.length) {
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = MUTED
    ctx.lineWidth = 1.5
    ctx.strokeRect(0, LABEL_ROW, MIN_CELL_W, CELL_H)
    ctx.setLineDash([])
    return
  }
  const last = obj.items.length - 1
  obj.items.forEach((item, i) => {
    const w = l.widths[i]
    drawCell(ctx, l.xs[i], LABEL_ROW, w, CELL_H, item)
    if (item.l) drawPointerLabel(ctx, item.l, l.xs[i] + w / 2)
    if (isQueue) {
      const tag = i === 0 && i === last ? 'front/back' : i === 0 ? 'front' : i === last ? 'back' : ''
      if (tag) drawCaption(ctx, tag, l.xs[i] + w / 2)
    } else {
      drawCaption(ctx, String(i), l.xs[i] + w / 2)
    }
  })
}

function drawStack(ctx, obj, l) {
  const n = obj.items.length
  ctx.textBaseline = 'middle'
  obj.items.forEach((item, i) => {
    // item 0 is the bottom of the stack
    const y = (n - 1 - i) * CELL_H
    drawCell(ctx, 0, y, l.cellW, CELL_H, item)
    const isTop = i === n - 1
    const note = [isTop ? 'top' : '', item.l].filter(Boolean).join(' · ')
    if (note) {
      ctx.fillStyle = item.l ? LABEL : MUTED
      ctx.font = `bold 13px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(`← ${note}`, l.cellW + 8, y + CELL_H / 2)
    }
  })
  // heavy base line
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  const baseY = Math.max(1, n) * CELL_H + 3
  ctx.beginPath()
  ctx.moveTo(-4, baseY)
  ctx.lineTo(l.cellW + 4, baseY)
  ctx.stroke()
  if (!n) {
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = MUTED
    ctx.strokeRect(0, 0, l.cellW, CELL_H)
    ctx.setLineDash([])
  }
}

function drawTree(ctx, obj, l) {
  if (!l.nodes.length) {
    ctx.fillStyle = MUTED
    ctx.font = `13px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('(empty tree)', l.w / 2, l.h / 2)
    return
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  for (const [a, b] of l.edges) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (const p of l.nodes) {
    const item = obj.items[p.i]
    ctx.beginPath()
    ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2)
    ctx.fillStyle = item.c || CELL_FILL
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = item.c ? ON_HIGHLIGHT : INK
    ctx.font = `bold 15px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.v, p.x, p.y + 1)
    if (item.l) {
      ctx.fillStyle = LABEL
      ctx.font = `bold 12px ${FONT}`
      ctx.fillText(item.l, p.x, p.y + NODE_R + 11)
    }
  }
}

function arrowTo(ctx, x1, y1, x2, y2, head = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45))
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45))
  ctx.closePath()
  ctx.fillStyle = INK
  ctx.fill()
}

function dot(ctx, x, y) {
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawList(ctx, obj, l) {
  const n = obj.items.length
  const y = LABEL_ROW
  const midY = y + LIST_NODE_H / 2
  ctx.lineWidth = 2
  ctx.strokeStyle = INK

  if (!n) {
    ctx.fillStyle = MUTED
    ctx.font = `13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('null', 0, midY)
    return
  }

  obj.items.forEach((item, i) => {
    const x = l.xs[i]
    const vx = x + (l.doubly ? LIST_PTR : 0)
    const vw = l.valW[i]
    const nw = l.nodeW[i]

    // pointer sections stay dark; the value section takes the highlight color
    ctx.fillStyle = CELL_FILL
    ctx.fillRect(x, y, nw, LIST_NODE_H)
    ctx.fillStyle = item.c || CELL_FILL
    ctx.fillRect(vx, y, vw, LIST_NODE_H)
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, nw, LIST_NODE_H)
    ctx.beginPath()
    ctx.moveTo(vx, y)
    ctx.lineTo(vx, y + LIST_NODE_H)
    ctx.moveTo(vx + vw, y)
    ctx.lineTo(vx + vw, y + LIST_NODE_H)
    ctx.stroke()

    ctx.fillStyle = item.c ? ON_HIGHLIGHT : INK
    ctx.font = `bold 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.v, vx + vw / 2, midY + 1)

    const nextDotX = vx + vw + LIST_PTR / 2
    dot(ctx, nextDotX, midY)
    if (l.doubly) dot(ctx, x + LIST_PTR / 2, midY)
    if (item.l) drawPointerLabel(ctx, item.l, x + nw / 2)

    const isLast = i === n - 1
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    if (!isLast) {
      if (l.doubly) {
        arrowTo(ctx, x + nw, y + LIST_NODE_H * 0.32, l.xs[i + 1], y + LIST_NODE_H * 0.32)
        arrowTo(ctx, l.xs[i + 1], y + LIST_NODE_H * 0.68, x + nw, y + LIST_NODE_H * 0.68)
      } else {
        arrowTo(ctx, nextDotX, midY, l.xs[i + 1] - 1, midY)
      }
    } else if (!l.hasCycle) {
      arrowTo(ctx, l.doubly ? x + nw : nextDotX, midY, x + nw + LIST_GAP - 2, midY)
      ctx.fillStyle = MUTED
      ctx.font = `13px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText('null', x + nw + LIST_GAP + 2, midY)
    }
  })

  if (l.hasCycle) {
    // tail points back to node `cycle`: loop under the row
    const last = n - 1
    const sx = l.xs[last] + l.nodeW[last] - LIST_PTR / 2
    const tx = l.xs[l.cycle] + l.nodeW[l.cycle] / 2
    const bottom = y + LIST_NODE_H
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx, midY)
    ctx.lineTo(sx, bottom)
    ctx.bezierCurveTo(sx, bottom + 40, tx, bottom + 40, tx, bottom + 8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tx, bottom + 1)
    ctx.lineTo(tx - 4.5, bottom + 9)
    ctx.lineTo(tx + 4.5, bottom + 9)
    ctx.closePath()
    ctx.fillStyle = INK
    ctx.fill()
  }
}

function drawHeap(ctx, obj, l) {
  if (!l.t) return drawTree(ctx, obj, l)
  ctx.save()
  ctx.translate(l.treeX, 0)
  drawTree(ctx, obj, l.t)
  ctx.restore()

  obj.items.forEach((item, i) => {
    const x = l.stripX + i * l.cellW
    drawCell(ctx, x, l.stripY, l.cellW, HEAP_CELL_H, item, 14, 1.5)
    ctx.fillStyle = MUTED
    ctx.font = `11px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i), x + l.cellW / 2, l.stripY + HEAP_CELL_H + 10)
  })
}

function drawGrid(ctx, obj, l) {
  ctx.fillStyle = MUTED
  ctx.font = `11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let c = 0; c < l.cols; c++) ctx.fillText(String(c), GRID_IDX_W + c * l.cellW + l.cellW / 2, GRID_IDX_H / 2)
  for (let r = 0; r < l.rows; r++) ctx.fillText(String(r), GRID_IDX_W / 2, GRID_IDX_H + r * GRID_CELL_H + GRID_CELL_H / 2)

  obj.items.forEach((item, i) => {
    const x = GRID_IDX_W + (i % l.cols) * l.cellW
    const y = GRID_IDX_H + Math.floor(i / l.cols) * GRID_CELL_H
    drawCell(ctx, x, y, l.cellW, GRID_CELL_H, item, 15, 1.5)
    if (item.l) {
      ctx.fillStyle = item.c ? ON_HIGHLIGHT : LABEL
      ctx.font = `bold 10px ${FONT}`
      ctx.textAlign = 'right'
      ctx.fillText(item.l, x + l.cellW - 3, y + GRID_CELL_H - 8)
    }
  })
}

/** Draw `obj` with its top-left corner at (obj.x, obj.y). */
export function drawObject(ctx, obj) {
  const l = layoutObject(obj)
  ctx.save()
  ctx.translate(obj.x, obj.y)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  if (obj.type === 'stack') drawStack(ctx, obj, l)
  else if (obj.type === 'tree') drawTree(ctx, obj, l)
  else if (obj.type === 'list') drawList(ctx, obj, l)
  else if (obj.type === 'heap') drawHeap(ctx, obj, l)
  else if (obj.type === 'grid') drawGrid(ctx, obj, l)
  else drawRow(ctx, obj, l)
  ctx.restore()
}

/**
 * Paint `obj` into its own canvas element (editor preview / drag ghost),
 * sized to fit and sharp on high-DPI screens.
 */
export function paintPreview(canvas, obj, pad = 12) {
  const { w, h } = layoutObject(obj)
  const dpr = window.devicePixelRatio || 1
  const cssW = Math.ceil(w + pad * 2)
  const cssH = Math.ceil(h + pad * 2)
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  drawObject(ctx, { ...obj, x: pad, y: pad })
  return { w: cssW, h: cssH, pad }
}

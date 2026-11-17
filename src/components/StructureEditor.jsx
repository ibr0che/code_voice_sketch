import React, { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../stores/useStore'
import {
  STRUCTURES, HIGHLIGHTS, defaultItems, defaultOpts, makeItem, createObject, paintPreview, optsOf,
} from '../lib/structures'
import { pressToDrag, DROP_EVENT } from '../lib/drag'
import styles from './StructureEditor.module.css'

const HINTS = {
  array: 'Edit cells like a spreadsheet. Labels (i, j, left…) appear as pointers above a cell.',
  stack: 'The first cell is the bottom of the stack, the last cell is the top.',
  queue: 'The first cell is the front of the queue, the last cell is the back.',
  tree: 'Level-order, like LeetCode: [1,2,3,null,4]. Leave a cell empty (or null) for a missing node.',
  list: 'Each cell is a node. Labels (head, slow, fast…) appear above a node. Use the options for a doubly linked list or a cycle.',
  heap: 'Enter the heap as an array. Children of index i are 2i+1 and 2i+2; the tree is drawn from it.',
  grid: 'Edit like a spreadsheet. Paste a whole matrix (e.g. [[1,0],[0,1]] or cells copied from Excel). Use Paint to color cells.',
}

const cycleColor = (c) => {
  const i = HIGHLIGHTS.indexOf(c)
  return i === HIGHLIGHTS.length - 1 ? null : HIGHLIGHTS[i + 1]
}

// ── Grid helpers: the grid is stored flat (row-major) with opts.cols ─────────

const toRows = (items, cols) => {
  const rows = []
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  return rows.length ? rows : [[makeItem()]]
}

/** Flatten rows back to a rectangular grid, padding short rows. */
const fromRows = (rows) => {
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const padded = rows.map((r) => [...r, ...Array.from({ length: cols - r.length }, () => makeItem())])
  return { items: padded.flat(), cols }
}

/** "[[1,0],[0,1]]", "1,0\n0,1" or tab-separated Excel cells -> array of rows. */
function parseMatrix(text) {
  let t = text.trim()
  if (!t) return null
  t = t.replace(/^\[+\s*/, '').replace(/\s*\]+$/, '')
  const rows = t.split(/\]\s*,?\s*\[|\r?\n/)
    .map((r) => r.split(/[\t,\s]+/).filter(Boolean))
    .filter((r) => r.length)
  const count = rows.reduce((n, r) => n + r.length, 0)
  return count >= 2 ? rows : null
}

export default function StructureEditor() {
  const editor = useStore((s) => s.editor)
  // Remount for every open so the local draft always starts fresh
  return editor ? <Dialog key={`${editor.type}:${editor.id ?? 'new'}`} editor={editor} /> : null
}

function Dialog({ editor }) {
  const { type, id } = editor
  const existing = useStore((s) => (id ? s.objects.find((o) => o.id === id) : null))
  const closeEditor = useStore((s) => s.closeEditor)
  const updateObject = useStore((s) => s.updateObject)

  const [data, setData] = useState(() => ({
    items: existing ? existing.items.map((it) => ({ ...it })) : defaultItems(type),
    opts: existing ? optsOf(existing) : defaultOpts(type),
  }))
  const { items, opts } = data
  const [dragging, setDragging] = useState(false)
  const [mode, setMode] = useState('edit')     // grid: 'edit' values or 'paint' colors
  const [brush, setBrush] = useState(HIGHLIGHTS[0]) // grid paint color (null = erase)
  const previewRef = useRef(null)
  const bodyRef = useRef(null)
  const isEdit = Boolean(id)
  const isGrid = type === 'grid'
  const label = STRUCTURES[type].label

  const setItems = (fn) => setData((d) => ({ ...d, items: typeof fn === 'function' ? fn(d.items) : fn }))
  const setOpts = (patch) => setData((d) => ({ ...d, opts: { ...d.opts, ...patch } }))
  const setGrid = (rows) => {
    const { items: flat, cols } = fromRows(rows)
    setData((d) => ({ items: flat, opts: { ...d.opts, cols } }))
  }

  const draft = useMemo(() => createObject(type, 0, 0, items, opts), [type, items, opts])

  useEffect(() => {
    if (previewRef.current) paintPreview(previewRef.current, draft)
  }, [draft])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeEditor() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeEditor])

  // ── Keyboard navigation (shared by both table kinds) ───────────────────────

  const focusCell = (row, col) =>
    bodyRef.current?.querySelector(`[data-cell="${row}-${col}"]`)?.focus()

  const onCellKey = (e, row, col) => {
    const el = e.currentTarget
    if (e.key === 'Enter' || (e.key === 'ArrowRight' && el.selectionStart === el.value.length)) {
      e.preventDefault()
      focusCell(row, col + 1)
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
      e.preventDefault()
      focusCell(row, col - 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(row + 1, col)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(row - 1, col)
    }
  }

  // ── Linear tables (array / stack / queue / tree / list / heap) ─────────────

  const setField = (i, field, value) =>
    setItems((cur) => cur.map((it, k) => (k === i ? { ...it, [field]: value } : it)))

  // Pasting "1, 2 3\t4" into a cell fills that cell and the ones after it
  const onPasteValues = (e, start) => {
    const text = e.clipboardData.getData('text')
    const parts = text.replace(/^\s*\[|\]\s*$/g, '').split(/[\s,]+/).filter(Boolean)
    if (parts.length < 2) return
    e.preventDefault()
    setItems((cur) => {
      const next = cur.map((it) => ({ ...it }))
      parts.forEach((p, k) => {
        if (next[start + k]) next[start + k].v = p
        else next.push(makeItem(p))
      })
      return next
    })
  }

  const addCell = () => setItems((cur) => [...cur, makeItem()])
  const removeCell = (i) => setItems((cur) => cur.filter((_, k) => k !== i))

  // ── Grid ───────────────────────────────────────────────────────────────────

  const gridRows = isGrid ? toRows(items, Math.max(1, opts.cols || 1)) : []

  const setGridValue = (r, c, v) =>
    setGrid(gridRows.map((row, ri) => row.map((it, ci) => (ri === r && ci === c ? { ...it, v } : it))))

  const paintCell = (r, c) =>
    setGrid(gridRows.map((row, ri) => row.map((it, ci) => (ri === r && ci === c ? { ...it, c: brush } : it))))

  const onPasteGrid = (e, r0, c0) => {
    const matrix = parseMatrix(e.clipboardData.getData('text'))
    if (!matrix) return
    e.preventDefault()
    const rows = gridRows.map((row) => row.map((it) => ({ ...it })))
    matrix.forEach((vals, dr) => {
      while (rows.length <= r0 + dr) rows.push([])
      vals.forEach((v, dc) => {
        const row = rows[r0 + dr]
        while (row.length <= c0 + dc) row.push(makeItem())
        row[c0 + dc] = { ...row[c0 + dc], v }
      })
    })
    setGrid(rows)
  }

  const addRow = () => setGrid([...gridRows, gridRows[0].map(() => makeItem())])
  const addCol = () => setGrid(gridRows.map((row) => [...row, makeItem()]))
  const removeRow = (r) => gridRows.length > 1 && setGrid(gridRows.filter((_, i) => i !== r))
  const removeCol = (c) => gridRows[0].length > 1 && setGrid(gridRows.map((row) => row.filter((_, i) => i !== c)))

  const reset = () => setData({ items: defaultItems(type), opts: defaultOpts(type) })

  // ── Placing the structure on the page ──────────────────────────────────────

  const insert = () => {
    window.dispatchEvent(new CustomEvent(DROP_EVENT, { detail: { obj: draft, center: true, handled: false } }))
    closeEditor()
  }

  const apply = () => {
    updateObject(id, { items, opts })
    closeEditor()
  }

  const startDrag = (e) =>
    pressToDrag(e, () => draft, {
      onDragStart: () => setDragging(true),
      onDragEnd: (handled) => (handled ? closeEditor() : setDragging(false)),
    })

  const cols = items.length
  const painting = isGrid && mode === 'paint'

  return (
    <div className={`${styles.backdrop} ${dragging ? styles.hidden : ''}`}>
      <div className={styles.dialog} role="dialog" aria-label={`${isEdit ? 'Edit' : 'Insert'} ${label}`}>
        <div className={styles.titleBar}>
          <span>{isEdit ? 'Edit' : 'Insert'} {label}</span>
          <button className={styles.close} onClick={closeEditor} title="Close (Esc)">✕</button>
        </div>

        <div className={styles.content}>
          <p className={styles.hint}>{HINTS[type]}</p>

          {isGrid && (
            <div className={styles.modeBar}>
              <button className={mode === 'edit' ? styles.modeOn : ''} onClick={() => setMode('edit')}>Edit values</button>
              <button className={mode === 'paint' ? styles.modeOn : ''} onClick={() => setMode('paint')}>Paint colors</button>
              {painting && (
                <span className={styles.brushes}>
                  {HIGHLIGHTS.map((c) => (
                    <button
                      key={c}
                      className={`${styles.brush} ${brush === c ? styles.brushOn : ''}`}
                      style={{ background: c }}
                      onClick={() => setBrush(c)}
                      title="Paint with this color"
                    />
                  ))}
                  <button
                    className={`${styles.brush} ${styles.brushNone} ${brush === null ? styles.brushOn : ''}`}
                    onClick={() => setBrush(null)}
                    title="Erase color"
                  />
                </span>
              )}
            </div>
          )}

          <div className={styles.tableWrap} ref={bodyRef}>
            {isGrid ? (
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <th />
                    {gridRows[0].map((_, c) => (
                      <td key={c} className={styles.index}>
                        {c}
                        <button className={styles.removeCol} onClick={() => removeCol(c)} title="Remove this column">×</button>
                      </td>
                    ))}
                  </tr>
                  {gridRows.map((row, r) => (
                    <tr key={r}>
                      <th className={styles.rowHead}>
                        {r}
                        <button className={styles.removeRow} onClick={() => removeRow(r)} title="Remove this row">×</button>
                      </th>
                      {row.map((it, c) => (
                        <td
                          key={c}
                          className={painting ? styles.paintable : undefined}
                          style={it.c ? { background: it.c } : undefined}
                          onPointerDown={painting ? () => paintCell(r, c) : undefined}
                          onPointerEnter={painting ? (e) => e.buttons === 1 && paintCell(r, c) : undefined}
                        >
                          <input
                            data-cell={`${r}-${c}`}
                            value={it.v}
                            readOnly={painting}
                            style={it.c ? { color: '#0d0d0f' } : undefined}
                            onChange={(e) => setGridValue(r, c, e.target.value)}
                            onPaste={(e) => onPasteGrid(e, r, c)}
                            onKeyDown={(e) => onCellKey(e, r, c)}
                            onFocus={(e) => !painting && e.target.select()}
                            autoFocus={r === 0 && c === 0}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <th>Index</th>
                      {items.map((_, i) => (
                        <td key={i} className={styles.index}>
                          {i}
                          <button className={styles.removeCol} onClick={() => removeCell(i)} title="Remove this cell">×</button>
                        </td>
                      ))}
                      <td rowSpan={4} className={styles.addCell}>
                        <button onClick={addCell} title="Add a cell">＋</button>
                      </td>
                    </tr>
                    <tr>
                      <th>Value</th>
                      {items.map((it, i) => (
                        <td key={i}>
                          <input
                            data-cell={`0-${i}`}
                            value={it.v}
                            placeholder={type === 'tree' ? 'null' : ''}
                            onChange={(e) => setField(i, 'v', e.target.value)}
                            onPaste={(e) => onPasteValues(e, i)}
                            onKeyDown={(e) => onCellKey(e, 0, i)}
                            onFocus={(e) => e.target.select()}
                            autoFocus={i === 0}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>Label</th>
                      {items.map((it, i) => (
                        <td key={i}>
                          <input
                            data-cell={`1-${i}`}
                            className={styles.labelInput}
                            value={it.l}
                            placeholder="—"
                            onChange={(e) => setField(i, 'l', e.target.value)}
                            onKeyDown={(e) => onCellKey(e, 1, i)}
                            onFocus={(e) => e.target.select()}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>Color</th>
                      {items.map((it, i) => (
                        <td key={i}>
                          <button
                            className={styles.swatch}
                            style={it.c ? { background: it.c } : undefined}
                            onClick={() => setField(i, 'c', cycleColor(it.c))}
                            title="Click to cycle highlight color"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                {cols === 0 && <div className={styles.empty}>No cells. Use ＋ to add one.</div>}
              </>
            )}
          </div>

          {type === 'list' && (
            <div className={styles.options}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(opts.doubly)}
                  onChange={(e) => setOpts({ doubly: e.target.checked })}
                />
                Doubly linked
              </label>
              <label>
                Tail points back to
                <select
                  value={opts.cycle >= 0 && opts.cycle < items.length ? opts.cycle : -1}
                  onChange={(e) => setOpts({ cycle: Number(e.target.value) })}
                >
                  <option value={-1}>none (null)</option>
                  {items.map((it, i) => <option key={i} value={i}>index {i}{it.v ? ` (${it.v})` : ''}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className={styles.tableActions}>
            {isGrid ? (
              <>
                <button onClick={addRow}>＋ Add row</button>
                <button onClick={addCol}>＋ Add column</button>
              </>
            ) : (
              <>
                <button onClick={addCell}>＋ Add cell</button>
                <button onClick={() => setItems((c) => c.slice(0, -1))} disabled={!cols}>− Remove last</button>
              </>
            )}
            <button onClick={reset}>Reset sample</button>
          </div>

          <div className={styles.previewBox}>
            <div className={styles.previewLabel}>
              Preview{!isEdit && <span> — drag it onto the page, or press Insert</span>}
            </div>
            <div className={styles.previewScroll}>
              <canvas
                ref={previewRef}
                className={isEdit ? styles.preview : `${styles.preview} ${styles.draggable}`}
                onPointerDown={isEdit ? undefined : startDrag}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {isEdit
            ? <button className={styles.primary} onClick={apply}>Apply</button>
            : <button className={styles.primary} onClick={insert}>Insert</button>}
          <button onClick={closeEditor}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

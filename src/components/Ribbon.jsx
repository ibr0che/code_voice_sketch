import React, { useEffect, useRef, useState } from 'react'
import useStore, { TOOLS, COLORS } from '../stores/useStore'
import { STRUCTURES, createObject } from '../lib/structures'
import { pressToDrag } from '../lib/drag'
import * as I from './icons'
import styles from './Ribbon.module.css'

const TOOL_BUTTONS = [
  { id: TOOLS.SELECT, Icon: I.SelectIcon, label: 'Select', key: 'V', hint: 'drag a box to select drawings and structures' },
  { id: TOOLS.PEN, Icon: I.PenIcon, label: 'Pencil', key: 'P' },
  { id: TOOLS.ERASER, Icon: I.EraserIcon, label: 'Eraser', key: 'E' },
  { id: TOOLS.TEXT, Icon: I.TextIcon, label: 'Text', key: 'T' },
]

const SHAPE_BUTTONS = [
  { id: TOOLS.LINE, Icon: I.LineIcon, label: 'Line', key: 'L' },
  { id: TOOLS.ARROW, Icon: I.ArrowIcon, label: 'Arrow', key: 'A' },
  { id: TOOLS.RECT, Icon: I.RectIcon, label: 'Rectangle', key: 'R' },
  { id: TOOLS.ELLIPSE, Icon: I.EllipseIcon, label: 'Ellipse', key: 'O' },
]

const SIZES = [1, 3, 5, 8]

function Group({ label, children, className = '' }) {
  return (
    <div className={`${styles.group} ${className}`}>
      <div className={styles.groupBody}>{children}</div>
      <div className={styles.groupLabel}>{label}</div>
    </div>
  )
}

function Big({ Icon, label, onClick, title, disabled, danger }) {
  return (
    <button
      className={`${styles.big} ${danger ? styles.danger : ''}`}
      onClick={onClick}
      title={title ?? label}
      disabled={disabled}
    >
      <Icon width={26} height={26} />
      <span>{label}</span>
    </button>
  )
}

function Small({ Icon, label, onClick, title, active, disabled, danger }) {
  return (
    <button
      className={`${styles.small} ${active ? styles.active : ''} ${danger ? styles.danger : ''}`}
      onClick={onClick}
      title={title ?? label}
      disabled={disabled}
    >
      <Icon width={18} height={18} />
      {label && <span>{label}</span>}
    </button>
  )
}

/** Compact "File ▾" dropdown holding Open / Save / Export. */
function FileMenu({ onOpen, onSave }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = [
    { Icon: I.OpenIcon, label: 'Open…', keys: 'Ctrl+O', run: onOpen },
    { Icon: I.SaveIcon, label: 'Save as PNG…', keys: 'Ctrl+S', run: onSave },
  ]

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        className={`${styles.menuButton} ${open ? styles.active : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <I.SaveIcon width={18} height={18} />
        <span>File</span>
        <span className={styles.caret}>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {items.map(({ Icon, label, keys, run }) => (
            <button
              key={label}
              role="menuitem"
              className={styles.menuItem}
              onClick={() => { setOpen(false); run() }}
            >
              <Icon width={16} height={16} />
              <span className={styles.menuLabel}>{label}</span>
              <span className={styles.menuKeys}>{keys}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Ribbon({ onClear, onDelete, onOpen, onSave }) {
  const activeTool = useStore((s) => s.activeTool)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const activeColor = useStore((s) => s.activeColor)
  const setActiveColor = useStore((s) => s.setActiveColor)
  const brushSize = useStore((s) => s.brushSize)
  const setBrushSize = useStore((s) => s.setBrushSize)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.historyIndex > 0)
  const canRedo = useStore((s) => s.historyIndex < s.history.length - 1)
  const editable = useStore((s) =>
    s.selectedIds.length === 1 && !s.bitmapSel ? s.objects.find((o) => o.id === s.selectedIds[0]) ?? null : null,
  )
  const hasSelection = useStore((s) => s.selectedIds.length > 0 || s.bitmapSel !== null)
  const openEditor = useStore((s) => s.openEditor)

  return (
    <div className={styles.ribbon}>
      <div className={styles.logo} title="Code Voice Sketch">
        <span className={styles.logoIcon}>⬡</span>
      </div>

      <Group label="File">
        <FileMenu onOpen={onOpen} onSave={onSave} />
      </Group>

      <Group label="Page">
        <div className={styles.col}>
          <Small Icon={I.UndoIcon} label="Undo" onClick={undo} disabled={!canUndo} title="Undo [Ctrl+Z]" />
          <Small Icon={I.RedoIcon} label="Redo" onClick={redo} disabled={!canRedo} title="Redo [Ctrl+Y]" />
        </div>
        <Big Icon={I.TrashIcon} label="Clear" onClick={onClear} danger title="Clear the whole page (undoable) [Ctrl+D]" />
      </Group>

      <Group label="Tools">
        <div className={styles.grid2}>
          {TOOL_BUTTONS.map(({ id, Icon, label, key, hint }) => (
            <Small
              key={id}
              Icon={Icon}
              active={activeTool === id}
              onClick={() => setActiveTool(id)}
              title={`${label} [${key}]${hint ? ` — ${hint}` : ''}`}
            />
          ))}
        </div>
      </Group>

      <Group label="Shapes">
        <div className={styles.grid2}>
          {SHAPE_BUTTONS.map(({ id, Icon, label, key }) => (
            <Small
              key={id}
              Icon={Icon}
              active={activeTool === id}
              onClick={() => setActiveTool(id)}
              title={`${label} [${key}]`}
            />
          ))}
        </div>
      </Group>

      <Group label="Size">
        <div className={styles.sizes}>
          {SIZES.map((size) => (
            <button
              key={size}
              className={`${styles.sizeBtn} ${brushSize === size ? styles.active : ''}`}
              onClick={() => setBrushSize(size)}
              title={`${size}px`}
            >
              <span style={{ height: size }} />
            </button>
          ))}
        </div>
      </Group>

      <Group label="Color">
        <div className={styles.currentColor} title="Current color">
          <span style={{ background: activeColor }} />
        </div>
        <div className={styles.palette}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.swatch} ${activeColor.toLowerCase() === c ? styles.swatchOn : ''}`}
              style={{ background: c }}
              onClick={() => setActiveColor(c)}
              title={c}
            />
          ))}
        </div>
        <label className={styles.customColor} title="Custom color">
          <input type="color" value={activeColor} onChange={(e) => setActiveColor(e.target.value)} />
          <span>Custom</span>
        </label>
      </Group>

      <Group label="Insert data structure" className={styles.insertGroup}>
        {Object.entries(STRUCTURES).map(([type, { label, short }]) => {
          const Icon = I.STRUCTURE_ICONS[type]
          return (
            <button
              key={type}
              className={`${styles.big} ${styles.structure}`}
              title={`${label}: click to edit then insert, or drag straight onto the page`}
              onPointerDown={(e) =>
                pressToDrag(e, () => createObject(type), { onClick: () => openEditor(type) })
              }
            >
              <Icon width={26} height={26} />
              <span>{short}</span>
            </button>
          )
        })}
        <div className={styles.col}>
          <Small
            Icon={I.EditIcon}
            label="Edit"
            disabled={!editable}
            onClick={() => editable && openEditor(editable.type, editable.id)}
            title="Edit the selected structure (or double-click it)"
          />
          <Small
            Icon={I.TrashIcon}
            label="Delete"
            disabled={!hasSelection}
            onClick={onDelete}
            danger
            title="Delete the selection [Del]"
          />
        </div>
      </Group>
    </div>
  )
}

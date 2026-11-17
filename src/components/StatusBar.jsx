import React from 'react'
import useStore from '../stores/useStore'
import { STRUCTURES } from '../lib/structures'
import styles from './StatusBar.module.css'

export default function StatusBar() {
  const cursor = useStore((s) => s.cursor)
  const { w, h } = useStore((s) => s.canvasSize)
  const selectedIds = useStore((s) => s.selectedIds)
  const bitmapSel = useStore((s) => s.bitmapSel)
  const selected = useStore((s) => (s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : null))
  const count = useStore((s) => s.objects.length)

  return (
    <div className={styles.bar}>
      <span className={styles.cell}>
        {cursor ? `✛ ${Math.round(cursor.x)}, ${Math.round(cursor.y)}px` : ' '}
      </span>
      <span className={styles.cell}>
        {selected && !bitmapSel
          ? `Selected: ${STRUCTURES[selected.type].label} (${selected.items.length} cells) — double-click to edit, Del to remove`
          : selectedIds.length || bitmapSel
            ? `Selection: ${bitmapSel ? 'drawing area' : ''}${bitmapSel && selectedIds.length ? ' + ' : ''}${selectedIds.length ? `${selectedIds.length} structure${selectedIds.length === 1 ? '' : 's'}` : ''} — drag to move, Del to remove`
            : `${count} data structure${count === 1 ? '' : 's'} on page`}
      </span>
      <span className={styles.spacer} />
      <span className={styles.cell}>▭ {w} × {h}px</span>
    </div>
  )
}

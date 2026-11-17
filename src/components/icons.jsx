import React from 'react'

// Small stroke icons (24x24 grid) in the flat Office style
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const make = (children) => function Icon(props) {
  return <svg {...base} {...props}>{children}</svg>
}

export const SelectIcon = make(<><rect x="4" y="5" width="16" height="14" strokeDasharray="3 2.5" /><path d="M13 13l6 6M13 13v5M13 13h5" /></>)
export const PenIcon = make(<><path d="M4 20l1-4 11-11 3 3L8 19z" /><path d="M14 7l3 3" /></>)
export const EraserIcon = make(<><path d="M5 15l8-9 6 5-6 8H8z" /><path d="M9 19h11" /></>)
export const TextIcon = make(<><path d="M6 6h12M12 6v13M9 19h6" /></>)
export const LineIcon = make(<path d="M5 19L19 5" />)
export const ArrowIcon = make(<path d="M5 19L19 5M10 5h9v9" />)
export const RectIcon = make(<rect x="4" y="6" width="16" height="12" />)
export const EllipseIcon = make(<ellipse cx="12" cy="12" rx="8" ry="6" />)
export const UndoIcon = make(<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 8" />)
export const RedoIcon = make(<path d="M15 7l5 5-5 5M20 12H10a6 6 0 000 8" />)
export const OpenIcon = make(<path d="M3 7h6l2 2h10v10H3zM3 11h18" />)
export const SaveIcon = make(<><path d="M5 4h12l3 3v13H5z" /><path d="M8 4v5h8V4M8 20v-6h8v6" /></>)
export const NewIcon = make(<path d="M6 3h8l4 4v14H6zM14 3v4h4" />)
export const TrashIcon = make(<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />)
export const EditIcon = make(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>)

// Data-structure icons
export const ArrayIcon = make(<><rect x="2.5" y="8" width="19" height="8" /><path d="M8.8 8v8M15.2 8v8" /></>)
export const StackIcon = make(<><path d="M6 3v18h12V3" /><path d="M6 9h12M6 15h12" /></>)
export const QueueIcon = make(<><path d="M2 7h20M2 17h20" /><path d="M8 7v10M14 7v10" /><path d="M19 10l3 2-3 2" /></>)
export const TreeIcon = make(<><circle cx="12" cy="5" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M10.6 7.2L7.4 15.8M13.4 7.2l3.2 8.6" /></>)

export const GridIcon = make(<><rect x="4" y="4" width="16" height="16" /><path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" /></>)
export const ListIcon = make(<><rect x="1.5" y="8.5" width="6" height="7" /><rect x="9" y="8.5" width="6" height="7" /><path d="M7.5 12H9M15 12h2.5M16 10l2 2-2 2" /><path d="M20 9v6" /></>)
export const HeapIcon = make(<><circle cx="12" cy="5" r="2.2" /><circle cx="6.5" cy="12" r="2.2" /><circle cx="17.5" cy="12" r="2.2" /><path d="M10.6 6.8L7.7 10.2M13.4 6.8l2.9 3.4" /><path d="M3 19.5h18M3 17h18v5H3zM9 17v5M15 17v5" strokeWidth="1.2" /></>)

export const STRUCTURE_ICONS = {
  array: ArrayIcon,
  stack: StackIcon,
  queue: QueueIcon,
  tree: TreeIcon,
  list: ListIcon,
  heap: HeapIcon,
  grid: GridIcon,
}

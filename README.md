# ⬡ Code Voice Sketch (Tauri)

A dark-mode desktop drawing app for LeetCode problem solving. Draw freehand, add shapes and text, and drag in arrays, stacks, queues, binary trees, linked lists, heaps and grids that you build in an Excel-style table editor.  
Built with **Tauri + Rust + React**. ~5MB bundle vs ~150MB for Electron.

---

## Prerequisites (Windows)

### 1. Rust
If not installed:
```powershell
winget install Rustlang.Rustup
# then restart your terminal
rustup default stable
```

### 2. Microsoft C++ Build Tools
Required by Tauri to compile Rust on Windows.  
Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/  
Select **"Desktop development with C++"** workload.

### 3. WebView2
Already installed on Windows 10/11. If missing:  
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 4. Node.js
https://nodejs.org (LTS recommended)

---

## Getting Started

```bash
npm install
npm run dev
```

This starts Vite on port 1420 and launches the Tauri window automatically.

## Build for Production

```bash
npm run build
```

Outputs an installer to `src-tauri/target/release/bundle/`.

---

## Using it

Everything lives on one page: a toolbar on top (File is a dropdown), a dark page that fills the window, and a status bar.

**Data structures** (Insert data structure group):
- **Drag** Array / Stack / Queue / Tree / List / Heap / Grid straight onto the page, or
- **Click** one to open the editor: edit cells like a spreadsheet (Value, Label, highlight Color), watch the live preview, then **drag the preview onto the page** or press **Insert**.
- In the editor you can paste `1, 2, 3` into a cell to fill several cells. Trees use LeetCode level-order (`[1,2,3,null,4]`, empty cell = null).
- **Linked List** options: doubly linked, and "tail points back to" a node for cycle problems.
- **Heap** is entered as an array and drawn as a tree (children of `i` are `2i+1`, `2i+2`) above its backing array.
- **Grid** is a 2D spreadsheet: paste a whole matrix (`[[1,0],[0,1]]` or cells copied from Excel), add/remove rows and columns, and use **Paint colors** to color cells.
- **Select** tool: drag a box to select drawn content and/or structures, then drag to move them together, or press Delete to remove them. Click a single structure to move it; double-click it (or press Enter) to edit it again.
- **Clear** wipes the page (undo brings it back).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select (drag a box, or click a structure) |
| `P` | Pencil |
| `E` | Eraser |
| `T` | Text |
| `L` / `A` / `R` / `O` | Line / Arrow / Rectangle / Ellipse |
| `Delete` | Remove the selection |
| `Enter` | Edit the selected structure |
| `Esc` | Deselect |
| `Ctrl+A` | Select everything |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+D` | Clear the page |
| `Ctrl+S` | Save as PNG |
| `Ctrl+O` | Open a session (.algo) |

---

## Project Structure

```
code-voice-sketch/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Tauri entry point, registers commands
│   │   └── commands.rs      # Rust file I/O commands (open session, save PNG)
│   ├── capabilities/        # Tauri v2 permissions for the main window
│   ├── icons/               # App icons (regenerate with `npx tauri icon <png>`)
│   ├── Cargo.toml
│   └── tauri.conf.json      # Window config, CSP, bundle settings
├── src/
│   ├── lib/
│   │   ├── structures.js    # Layout + drawing of every data structure
│   │   ├── drag.js          # Pointer-based drag and drop
│   │   └── files.js         # Open/save-PNG (Tauri invoke + browser fallback)
│   ├── components/
│   │   ├── Ribbon.jsx           # Toolbar (File dropdown, tools, colors, insert)
│   │   ├── Canvas.jsx           # Page: bitmap layer + structures layer
│   │   ├── StructureEditor.jsx  # Excel-style table editor dialog
│   │   └── StatusBar.jsx
│   ├── stores/useStore.js   # Zustand: tools, objects, undo/redo history
│   └── App.jsx              # Layout, shortcuts, file actions
├── index.html
├── vite.config.js
└── package.json
```

---

## Tauri vs Electron — Key Differences

| | Electron | Tauri |
|---|---|---|
| Backend | Node.js | Rust |
| Bundle size | ~150MB | ~5MB |
| Memory | ~100MB | ~30MB |
| IPC | `ipcRenderer` / preload | `invoke()` from `@tauri-apps/api` |
| File dialog | `dialog` module | `tauri-plugin-dialog` (called from Rust) |
| WebView | Chromium (bundled) | OS WebView (Edge on Windows) |

---

## Extending

- Graph, hash map and trie structures
- Resize handles for placed structures
- Problem notes keyed to LeetCode problem number
- Multiple canvas tabs

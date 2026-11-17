import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import App from './App.jsx'
import './index.css'

// Structures are drawn on a <canvas> and sized by measuring text, so the mono
// font must be ready before the first render or cells would be mis-sized.
const fonts = ['400 16px', '500 13px', '700 16px'].map((f) =>
  document.fonts.load(`${f} 'JetBrains Mono'`).catch(() => {}),
)

Promise.all(fonts).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})

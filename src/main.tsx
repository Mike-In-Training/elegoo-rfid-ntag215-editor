import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { tracePhoto } from './lib/photoDiagnostics'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', () => {
    tracePhoto('Vite requested full page reload');
  });
}

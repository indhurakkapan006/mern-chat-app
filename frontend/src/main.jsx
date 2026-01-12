import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress Zustand deprecation warnings from browser extensions
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = function(...args) {
    if (args[0]?.includes?.('[DEPRECATED]') && args[0]?.includes?.('zustand')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
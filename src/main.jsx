import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Background layers — rendered outside App so they're always present */}
    <div className="bg-void" />
    <div className="bg-scanlines" />
    <div className="bg-grid" />
    <App />
  </StrictMode>
);


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

const isMobileOrTabletView = window.matchMedia("(max-width: 1366px)").matches;
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
  forceApply: isMobileOrTabletView
});
window.addEventListener('touchmove', function() {}, {passive: false});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

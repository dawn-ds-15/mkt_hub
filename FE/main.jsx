import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

(function bootstrapTheme() {
  try {
    const saved = localStorage.getItem('mkt_hub_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    }
    document.documentElement.classList.add('theme-anim');
  } catch (e) {}
})();

if (import.meta.env.PROD) {
  const noop = () => {};
  console.log = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  console.error = noop;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

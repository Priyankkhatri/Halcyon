import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './context/AppContext.jsx'

// Apply the theme before first paint so pre-shell screens (landing, auth,
// onboarding) render with an intentional default. Dark is the default when unset.
const savedTheme = localStorage.getItem('theme');
if (savedTheme !== 'light') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

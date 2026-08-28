import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './ErrorBoundary'
import './styles.css'

// GitHub Pages does not provide server-side route fallbacks. Keep hash routing in
// both demo and connected modes so direct links and page refreshes remain usable.
const Router = HashRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><Router><AuthProvider><App /></AuthProvider></Router></ErrorBoundary></React.StrictMode>,
)

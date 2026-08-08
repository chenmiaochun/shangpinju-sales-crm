import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './ErrorBoundary'
import './styles.css'

const Router = import.meta.env.VITE_STATIC_DEMO === 'true' ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><Router><AuthProvider><App /></AuthProvider></Router></ErrorBoundary></React.StrictMode>,
)

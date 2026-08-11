import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Catches any unexpected render/runtime error and shows a recoverable screen
// instead of a dead white page (so a stray bug never means reinstalling the app).
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5EFE6', color: '#1F2421', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>Lull<span style={{ color: '#C8553D' }}>.</span></div>
            <p style={{ opacity: 0.7, marginBottom: 20 }}>Something hiccuped. Your data is safe.</p>
            <button
              onClick={() => { this.setState({ failed: false }); window.location.reload() }}
              style={{ background: '#C8553D', color: '#F5EFE6', border: 'none', borderRadius: 999, padding: '12px 24px', fontSize: 16, fontWeight: 500 }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

import { Component, type ErrorInfo, type ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Do not log document content or access tokens. */ }
  render() { return this.state.failed ? <main className="app-error"><h1>The vault could not be displayed.</h1><p>Please reload to try again. If the problem continues, contact the vault owner.</p><button className="primary-button" onClick={() => location.reload()}>Reload vault</button></main> : this.props.children }
}

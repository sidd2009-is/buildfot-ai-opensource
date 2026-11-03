import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message || String(e) }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: '#6b7a86' }}>
          <div>
            <b style={{ color: '#14212b' }}>3D view could not start</b>
            <p style={{ maxWidth: 360 }}>Your browser may have WebGL turned off. Try Chrome or Edge with hardware acceleration on.</p>
            <small style={{ opacity: 0.6 }}>{this.state.error}</small><br />
            <button style={{ marginTop: 10 }} onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

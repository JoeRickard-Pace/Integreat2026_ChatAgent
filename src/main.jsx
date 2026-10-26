import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <div className="chat-window">
            <div className="error-banner" style={{ margin: '24px' }}>
              The chat encountered an unexpected error and reset safely.
              <div style={{ marginTop: '8px', opacity: 0.8 }}>{this.state.message}</div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

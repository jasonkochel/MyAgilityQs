import React from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send error to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true);
      scope.setContext('errorInfo', {
        componentStack: errorInfo.componentStack,
      });
      Sentry.captureException(error);
    });

    // Store error in localStorage for debugging on mobile
    try {
      localStorage.setItem('lastError', JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        errorInfo: errorInfo
      }));
    } catch (e) {
      console.error('Failed to store error in localStorage:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h1 style={{ color: '#dc3545', marginBottom: '20px' }}>Something went wrong</h1>
          <p style={{ marginBottom: '20px', maxWidth: '400px' }}>
            The app encountered an error. This usually happens due to a temporary issue.
          </p>
          <details style={{ marginBottom: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>Error Details</summary>
            <pre style={{
              background: '#f1f3f4',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              maxWidth: '90vw'
            }}>
              {this.state.error?.message || 'Unknown error'}
              {'\n\n'}
              {this.state.error?.stack || 'No stack trace available'}
            </pre>
          </details>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload App
            </button>
            <button
              onClick={() => {
                // Clear all stored data and reload
                localStorage.clear();
                sessionStorage.clear();
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                  }).then(() => {
                    location.reload();
                  });
                } else {
                  location.reload();
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Cache & Reload
            </button>
          </div>
          <p style={{
            marginTop: '20px',
            fontSize: '12px',
            color: '#6c757d',
            maxWidth: '400px'
          }}>
            If the problem persists, try clearing your browser cache or reinstalling the PWA.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

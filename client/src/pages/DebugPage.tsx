import React from 'react';

export const DebugPage: React.FC = () => {
  const [debugInfo, setDebugInfo] = React.useState<any>(null);

  React.useEffect(() => {
    // Collect debug information
    const lastError = localStorage.getItem('lastError');
    const debugData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: Object.keys(localStorage).reduce((acc, key) => {
        try {
          acc[key] = localStorage.getItem(key);
        } catch (e) {
          acc[key] = 'Error reading value';
        }
        return acc;
      }, {} as Record<string, string | null>),
      sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
        try {
          acc[key] = sessionStorage.getItem(key);
        } catch (e) {
          acc[key] = 'Error reading value';
        }
        return acc;
      }, {} as Record<string, string | null>),
      lastError: lastError ? JSON.parse(lastError) : null,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      supportedFeatures: {
        serviceWorker: 'serviceWorker' in navigator,
        localStorage: typeof(Storage) !== "undefined",
        sessionStorage: typeof(Storage) !== "undefined",
        fetch: typeof fetch !== 'undefined',
        pwa: window.matchMedia('(display-mode: standalone)').matches
      }
    };

    setDebugInfo(debugData);
  }, []);

  const clearAllData = () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    alert('All data cleared! Reload the page to continue.');
  };

  const copyToClipboard = () => {
    const text = JSON.stringify(debugInfo, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Debug info copied to clipboard!');
      });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Debug info copied to clipboard!');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>Debug Information</h1>
      <p>This page helps troubleshoot issues on mobile devices.</p>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => window.location.href = '/'}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          ← Back to App
        </button>
        <button
          onClick={copyToClipboard}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          Copy Debug Info
        </button>
        <button
          onClick={clearAllData}
          style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white' }}
        >
          Clear All Data
        </button>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '5px',
        overflow: 'auto',
        maxHeight: '70vh'
      }}>
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div>
    </div>
  );
};

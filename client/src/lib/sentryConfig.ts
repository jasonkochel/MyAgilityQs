import * as Sentry from "@sentry/react";

// Validate required environment variables
if (!import.meta.env.VITE_SENTRY_DSN) {
  throw new Error('VITE_SENTRY_DSN environment variable is required');
}
if (!import.meta.env.VITE_ENVIRONMENT) {
  throw new Error('VITE_ENVIRONMENT environment variable is required');
}

// Initialize Sentry
export const initializeSentry = () => {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT,
    release: `client-${import.meta.env.VITE_BUILD_TIMESTAMP || Date.now()}`,
    integrations: [
      Sentry.browserTracingIntegration({
        // Enable router instrumentation for wouter
        enableInp: true,
      }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Environment-specific sampling rates
    tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: import.meta.env.VITE_ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: true,
    
    // Error filtering to reduce noise
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      // Filter out expected errors and noise
      if (error instanceof Error) {
        const message = error.message;
        
        // Network errors that are expected in offline scenarios
        if (message.includes('Failed to fetch') || 
            message.includes('NetworkError') ||
            message.includes('Load failed')) {
          return null;
        }
        
        // React DevTools errors in development
        if (import.meta.env.VITE_ENVIRONMENT !== "production" && 
            message.includes('React DevTools')) {
          return null;
        }
        
        // Cognito expected auth errors
        if (message.includes('NotAuthorizedException') ||
            message.includes('UserNotConfirmedException')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Additional context for debugging
    initialScope: {
      tags: {
        component: 'client',
        version: import.meta.env.VITE_BUILD_TIMESTAMP || Date.now().toString(),
      },
    },
  });
};
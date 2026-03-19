import * as Sentry from "@sentry/react";

const isProduction = import.meta.env.PROD;

// Initialize Sentry (production only)
export const initializeSentry = () => {
  if (!isProduction) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT || "production",
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
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
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
        
        // Expected auth errors (expired tokens, refresh failures)
        if (message.includes('NotAuthorizedException') ||
            message.includes('UserNotConfirmedException') ||
            message.includes('401')) {
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
import * as Sentry from "@sentry/react";

// Centralized Sentry error reporting utilities
export interface ErrorContext {
  [key: string]: any;
}

export interface ErrorReportOptions {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string>;
  contexts?: Record<string, ErrorContext>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}

/**
 * Centralized error reporting function
 * @param error - The error to report
 * @param errorType - Type of error for tagging
 * @param options - Additional Sentry options
 */
export function reportError(
  error: Error | string,
  errorType: string,
  options: ErrorReportOptions = {}
): void {
  // Don't report expected auth errors or network errors to reduce noise
  const errorMessage = error instanceof Error ? error.message : error;
  
  if (errorMessage.includes('NotAuthorizedException') ||
      errorMessage.includes('UserNotConfirmedException') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError')) {
    return;
  }

  Sentry.withScope((scope) => {
    // Set error type tag
    scope.setTag("errorType", errorType);
    
    // Set level (default to error)
    scope.setLevel(options.level || "error");
    
    // Add custom tags
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    
    // Add contexts
    if (options.contexts) {
      Object.entries(options.contexts).forEach(([key, context]) => {
        scope.setContext(key, context);
      });
    }
    
    // Set user context if provided
    if (options.user) {
      scope.setUser(options.user);
    }
    
    // Capture the exception
    const errorToCapture = error instanceof Error ? error : new Error(errorMessage);
    Sentry.captureException(errorToCapture);
  });
}

// Specific error reporting functions for common use cases

export function reportAuthError(error: Error, authType: 'init' | 'login' | 'refresh', context: ErrorContext = {}) {
  reportError(error, `auth_${authType}`, {
    level: authType === 'login' ? 'error' : 'warning',
    contexts: {
      auth: context,
    },
  });
}

export function reportHttpError(error: Error, requestContext: ErrorContext = {}) {
  reportError(error, 'http', {
    contexts: {
      http: requestContext,
      request: requestContext,
    },
  });
}

export function reportQueryError(error: Error, queryContext: ErrorContext = {}) {
  reportError(error, 'query_infrastructure', {
    contexts: {
      query: queryContext,
    },
  });
}

export function reportMutationError(error: Error, mutationContext: ErrorContext = {}) {
  reportError(error, 'mutation', {
    contexts: {
      mutation: mutationContext,
    },
  });
}

export function reportNetworkError(error: Error, networkContext: ErrorContext = {}) {
  reportError(error, 'network', {
    contexts: {
      network: networkContext,
    },
  });
}

export function reportApiError(error: Error, apiContext: ErrorContext = {}) {
  reportError(error, 'api', {
    contexts: {
      api: apiContext,
    },
  });
}
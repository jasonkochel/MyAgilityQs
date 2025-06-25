import { QueryClient, QueryCache } from "@tanstack/react-query";
import { reportQueryError } from "./sentry";

// Create a client for React Query (HTTP error reporting handled by ky)
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1, // Only retry once
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnReconnect: true, // Do refetch when reconnecting
      },
      mutations: {
        retry: 0, // Don't retry mutations
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only report TanStack Query-specific errors (not HTTP errors - those are handled by ky)
        if (error instanceof Error) {
          // Report query infrastructure errors (not HTTP/API errors)
          if (error.message.includes('QueryCache') || 
              error.message.includes('QueryClient') ||
              error.message.includes('Invalid query')) {
            
            reportQueryError(error, {
              queryKey: query.queryKey,
              queryHash: query.queryHash,
              error: error.message,
            });
          }
        }
      },
    }),
  });
};
import { useLocation, useSearch } from 'wouter';

/**
 * Custom hook to manage state in URL search parameters
 * Uses URL as single source of truth, eliminating duplicate state
 */
export function useURLState<T extends Record<string, string | null>>(
  defaultValues: T
): [T, (updates: Partial<T>) => void] {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  // Parse current state from URL
  const currentState = () => {
    const params = new URLSearchParams(searchString);
    const state = { ...defaultValues };
    
    for (const key in defaultValues) {
      const value = params.get(key);
      if (value !== null) {
        state[key] = value as T[typeof key];
      }
    }
    
    return state;
  };
  
  // Update URL with new state
  const updateState = (updates: Partial<T>) => {
    const current = currentState();
    const newState = { ...current, ...updates };
    
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(newState)) {
      // Only add to URL if not the default value and not null
      if (value !== null && value !== defaultValues[key]) {
        params.set(key, value);
      }
    }
    
    const search = params.toString();
    const currentPath = window.location.pathname;
    setLocation(`${currentPath}${search ? '?' + search : ''}`, { replace: true });
  };
  
  return [currentState(), updateState];
}
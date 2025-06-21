import { useLocation } from 'wouter';

/**
 * Custom hook for handling back navigation that respects browser history
 * Falls back to a default route if no history is available
 */
export function useNavigationHistory(fallbackRoute: string = '/') {
  const [, setLocation] = useLocation();

  const goBack = () => {
    // Check if there's previous history
    if (window.history.length > 1) {
      // Use browser's back functionality
      window.history.back();
    } else {
      // Fallback to default route if no history
      setLocation(fallbackRoute);
    }
  };

  const goToRoute = (route: string) => {
    setLocation(route);
  };

  return { goBack, goToRoute };
}
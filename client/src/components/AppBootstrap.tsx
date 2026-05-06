import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import { dogsApi, locationsApi } from "../lib/api";
import { AppLoadingScreen } from "./AppLoadingScreen";

interface AppBootstrapProps {
  children: React.ReactNode;
}

// Single interstitial between "logged in" and "ready to render". Loads the
// data the rest of the app assumes is in cache (dogs + locations), then
// either routes brand-new users to /welcome or releases the gate so the
// requested route can render. Mounted by ProtectedRoute after auth passes,
// so unauthenticated visitors never get here.
export const AppBootstrap: React.FC<AppBootstrapProps> = ({ children }) => {
  const [location] = useLocation();
  const dogs = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
    staleTime: Infinity,
  });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: locationsApi.getAll,
    staleTime: Infinity,
  });

  if (dogs.isLoading || locations.isLoading) {
    return <AppLoadingScreen />;
  }

  // First-time onboarding: brand-new account → drop on /welcome. Skip the
  // redirect when we're already there to avoid a self-redirect loop.
  if (dogs.data?.length === 0 && location !== "/welcome") {
    return <Redirect to="/welcome" />;
  }

  return <>{children}</>;
};

import { Redirect } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { AppBootstrap } from "../AppBootstrap";
import { AppLoadingScreen } from "../AppLoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // AppBootstrap loads dogs/locations and decides whether brand-new users
  // need to go to /welcome before showing the requested route.
  return <AppBootstrap>{children}</AppBootstrap>;
};

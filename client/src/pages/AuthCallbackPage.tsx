import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import type { AuthResponse } from "../types";

export const AuthCallbackPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");

        console.log("OAuth callback received:", {
          url: window.location.href,
          code: code ? `${code.substring(0, 10)}...` : null,
          error,
          errorDescription,
          allParams: Object.fromEntries(urlParams.entries()),
        });

        if (error) {
          console.error("OAuth error details:", { error, errorDescription });
          throw new Error(
            `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`
          );
        }

        if (!code) {
          console.error("No authorization code in URL:", window.location.href);
          throw new Error("No authorization code received");
        }

        // Prevent double-processing of the same code (StrictMode in dev
        // double-invokes effects). Returning early keeps the loading screen
        // up — never set local state that could trigger a render to null.
        if (sessionStorage.getItem(`oauth_code_${code}`)) {
          console.log("Code already processed, skipping");
          return;
        }
        sessionStorage.setItem(`oauth_code_${code}`, "used");
        console.log("Exchanging code for tokens...");
        // Get the redirect URI that was used in the initial request
        const redirectUri = sessionStorage.getItem("google_oauth_redirect_uri");

        // Exchange the code for tokens via our backend
        const authData: AuthResponse = await authApi.googleCallback(code, redirectUri || undefined);

        // Clean up the stored redirect URI
        sessionStorage.removeItem("google_oauth_redirect_uri");

        console.log("Tokens received, logging in...");
        await login(authData);

        console.log("Login successful, redirecting...");
        // ProtectedRoute → AppBootstrap continues showing the loading screen
        // while it loads dogs/locations, so the visual is unbroken.
        setLocation("/");
      } catch (err) {
        console.error("OAuth callback error:", err);

        notifications.show({
          title: "Sign In Failed",
          message: err instanceof Error ? err.message : "Failed to sign in with Google",
          color: "red",
          icon: <IconX size="1rem" />,
        });

        setLocation("/login");
      }
    };

    handleCallback();
  }, [login, setLocation]);

  // Always render the same loading screen the rest of the flow uses; the
  // component unmounts naturally when setLocation fires above.
  return <AppLoadingScreen />;
};

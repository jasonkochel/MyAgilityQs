import { notifications } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import type { AuthResponse } from "../types";

export const AuthCallbackPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Prevent double-processing of the same code
        if (sessionStorage.getItem(`oauth_code_${code}`)) {
          // Already processed, do nothing
          return;
        }
        sessionStorage.setItem(`oauth_code_${code}`, "used");

        // Exchange the code for tokens via our backend
        const authData: AuthResponse = await authApi.googleCallback(code);

        // Login with the received tokens
        await login(authData);

        // Show success notification
        notifications.show({
          title: "Welcome!",
          message: "Successfully signed in with Google",
          color: "green",
          icon: <IconCheck size="1rem" />,
        });

        // Redirect to main menu
        setLocation("/");
      } catch (error) {
        console.error("OAuth callback error:", error);

        notifications.show({
          title: "Sign In Failed",
          message: error instanceof Error ? error.message : "Failed to sign in with Google",
          color: "red",
          icon: <IconX size="1rem" />,
        });

        // Redirect back to login page
        setLocation("/login");
      } finally {
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [login, setLocation]);

  if (isProcessing) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>Processing sign in...</div>
        <div>Please wait while we complete your authentication.</div>
      </div>
    );
  }

  return null;
};

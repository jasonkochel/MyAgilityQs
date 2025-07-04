import { Container, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDog, IconX } from "@tabler/icons-react";
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
        const errorDescription = urlParams.get("error_description");

        console.log("OAuth callback received:", {
          url: window.location.href,
          code: code ? `${code.substring(0, 10)}...` : null,
          error,
          errorDescription,
          allParams: Object.fromEntries(urlParams.entries())
        });

        if (error) {
          console.error("OAuth error details:", { error, errorDescription });
          throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
        }

        if (!code) {
          console.error("No authorization code in URL:", window.location.href);
          throw new Error("No authorization code received");
        }

        // Prevent double-processing of the same code
        if (sessionStorage.getItem(`oauth_code_${code}`)) {
          console.log("Code already processed, skipping");
          return;
        }
        sessionStorage.setItem(`oauth_code_${code}`, "used");        console.log("Exchanging code for tokens...");
        // Get the redirect URI that was used in the initial request
        const redirectUri = sessionStorage.getItem('google_oauth_redirect_uri');

        // Exchange the code for tokens via our backend
        const authData: AuthResponse = await authApi.googleCallback(code, redirectUri || undefined);

        // Clean up the stored redirect URI
        sessionStorage.removeItem('google_oauth_redirect_uri');

        console.log("Tokens received, logging in...");
        // Login with the received tokens
        await login(authData);

        console.log("Login successful, redirecting...");
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
      <Container 
        size={420} 
        style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh" 
        }}
      >
        <Paper withBorder shadow="md" p={40} radius="md">
          <Stack align="center" gap="xl">
            <IconDog size={48} color="var(--mantine-color-blue-6)" />
            <Title order={3} ta="center" c="blue.6">
              MyAgilityQs
            </Title>
            <Stack align="center" gap="md">
              <Loader color="blue" size="lg" />
              <Text size="lg" fw={500} ta="center">
                Processing sign in...
              </Text>
              <Text c="dimmed" size="sm" ta="center">
                Please wait while we complete your authentication
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return null;
};

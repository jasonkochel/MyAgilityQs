import {
  Alert,
  Button,
  Container,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconDog } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { GoogleIcon } from "../components/GoogleIcon";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import type { LoginForm } from "../types";

export const LoginPage: React.FC = () => {
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect when authenticated (after login completes)
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const form = useForm<LoginForm>({
    initialValues: {
      email: "",
      password: "",
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
      password: (value) => (value.length < 6 ? "Password must be at least 6 characters" : null),
    },
  });

  // Show branded loading while checking auth, after login, or during Google redirect
  if (authLoading || isAuthenticated || googleRedirecting) {
    return <AppLoadingScreen />;
  }

  const handleSubmit = async (values: LoginForm) => {
    setEmailLoading(true);
    setError(null);
    try {
      const authData = await authApi.login(values);
      await login(authData);

      // Success - redirect will be handled by useEffect
    } catch (err) {
      // Convert raw error to user-friendly message
      let userFriendlyMessage = "Login failed. Please try again.";

      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (
          errorMessage.includes("401") ||
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("incorrect")
        ) {
          userFriendlyMessage =
            "Invalid email or password. Please check your credentials and try again.";
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          userFriendlyMessage = "Network error. Please check your connection and try again.";
        } else if (
          errorMessage.includes("user not found") ||
          errorMessage.includes("user does not exist")
        ) {
          userFriendlyMessage = "No account found with this email address.";
        }
      }

      setError(userFriendlyMessage);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { url, redirectUri: serverRedirectUri } = await authApi.getGoogleLoginUrl(redirectUri);

      sessionStorage.setItem('google_oauth_redirect_uri', serverRedirectUri);

      // Show branded loading screen before the browser navigates away
      setGoogleRedirecting(true);
      window.location.href = url;
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to initiate Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <Container size={420} my={40} style={{ position: "relative" }}>
      <Stack align="center">
        <IconDog size={48} color="var(--mantine-color-blue-6)" />
        <Title ta="center" c="blue.6">
          MyAgilityQs
        </Title>
        <Text c="dimmed" size="sm" ta="center">
          Track your dog's agility progress
        </Text>
      </Stack>
      <Paper withBorder shadow="md" p={30} mt={20} radius="md">
        <Stack gap="sm">
          {error && (
            <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="light">
              {error}
            </Alert>
          )}

          {/* Traditional Login Form */}
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="your@email.com"
                required
                autoComplete="email"
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                required
                autoComplete="current-password"
                {...form.getInputProps("password")}
              />
              <Button
                type="submit"
                fullWidth
                size="lg"
                mt="md"
                loading={emailLoading}
                disabled={googleLoading}
                style={{ height: "48px" }}
              >
                Log In
              </Button>
            </Stack>
          </form>

          <Divider
            label="or"
            labelPosition="center"
            styles={{
              label: {
                fontSize: "var(--mantine-font-size-md)",
              },
            }}
          />

          {/* Google Sign In Button */}
          <Button
            fullWidth
            size="lg"
            leftSection={<GoogleIcon size={20} />}
            onClick={handleGoogleSignIn}
            loading={googleLoading}
            disabled={emailLoading}
            style={{
              backgroundColor: emailLoading ? undefined : "#4285f4",
              color: emailLoading ? undefined : "white",
              border: "none",
              fontWeight: 500,
              height: "48px",
            }}
          >
            Log In with Google
          </Button>
        </Stack>
      </Paper>
      <Text c="dimmed" size="sm" ta="center" mt="md" fw={500}>
        Don't have an account?{" "}
        <Text component={Link} href="/signup" c="blue" fw={500} style={{ textDecoration: "none" }}>
          Create one here
        </Text>
      </Text>
    </Container>
  );
};

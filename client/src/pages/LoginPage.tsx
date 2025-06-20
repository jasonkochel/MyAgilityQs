import {
  Alert,
  Button,
  Container,
  Divider,
  LoadingOverlay,
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
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import type { LoginForm } from "../types";

// Google Logo Component with white background
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <div
    style={{
      width: size + 4,
      height: size + 4,
      backgroundColor: "white",
      borderRadius: "2px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2px",
    }}
  >
    <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  </div>
);

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth(); // Use effect to handle redirect instead of doing it in render
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

  // Don't render the form if already authenticated
  if (isAuthenticated) {
    return null;
  }
  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
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
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the Google OAuth URL from our backend
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { url } = await authApi.getGoogleLoginUrl(redirectUri);

      // Redirect to Google OAuth
      window.location.href = url;
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to initiate Google sign-in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40} style={{ position: "relative" }}>
      <LoadingOverlay visible={loading} />
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
                loading={loading}
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
            loading={loading}
            style={{
              backgroundColor: "#4285f4",
              color: "white",
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

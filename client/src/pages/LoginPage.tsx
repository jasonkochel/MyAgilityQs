import {
  Alert,
  Button,
  Container,
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
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import type { LoginForm } from "../types";

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();

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

  // Redirect if already authenticated
  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError(null);

    try {
      const authData = await authApi.login(values);
      login(authData, values.email);

      // Success - redirect without showing a toast (the redirect is clear enough)
      setLocation("/");
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
      // Remove the toast notification - we'll show error in the form instead
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40} style={{ position: "relative" }}>
      <LoadingOverlay visible={loading} />

      <Stack align="center" mb="xl">
        <IconDog size={48} color="var(--mantine-color-blue-6)" />
        <Title ta="center" c="blue.6">
          MyAgilityQs
        </Title>
        <Text c="dimmed" size="sm" ta="center">
          Track your dog's agility progress
        </Text>
      </Stack>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Title order={2} ta="center" mb="md">
              Sign In
            </Title>
            {error && (
              <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="light">
                {error}
              </Alert>
            )}
            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              {...form.getInputProps("email")}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              {...form.getInputProps("password")}
            />{" "}
            <Button type="submit" fullWidth mt="xl" loading={loading}>
              Sign In
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
};

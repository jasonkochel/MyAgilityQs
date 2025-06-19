import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconUserPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authApi } from "../lib/api";

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export const SignupPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    initialValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
    },
    validate: {
      email: (value) => {
        if (!value) return "Email is required";
        if (!/^\S+@\S+\.\S+$/.test(value)) return "Please enter a valid email";
        return null;
      },
      password: (value) => {
        if (!value) return "Password is required";
        if (value.length < 8) return "Password must be at least 8 characters";
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
        }
        return null;
      },
      confirmPassword: (value, values) => {
        if (!value) return "Please confirm your password";
        if (value !== values.password) return "Passwords do not match";
        return null;
      },
    },
  });

  const signupMutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: () => {
      notifications.show({
        title: "Account Created!",
        message: "You can now log in with your credentials",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      setLocation("/login");
    },
    onError: (err) => {
      console.error("Signup error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
    },
  });

  const handleSubmit = (values: SignupFormData) => {
    setError(null);
    signupMutation.mutate({
      email: values.email,
      password: values.password,
      name: values.name || undefined,
    });
  };

  return (
    <Container size="xs" py="xl">
      <Stack gap="xl">
        <Stack gap="xs" align="center">
          <Title order={2}>Create Account</Title>
          <Text c="dimmed" size="sm">
            Join MyAgilityQs to track your dog's agility progress
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="your@email.com"
                required
                {...form.getInputProps("email")}
              />

              <TextInput
                label="Name (Optional)"
                placeholder="Your name"
                {...form.getInputProps("name")}
              />

              <PasswordInput
                label="Password"
                placeholder="Create a strong password"
                required
                {...form.getInputProps("password")}
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                required
                {...form.getInputProps("confirmPassword")}
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={signupMutation.isPending}
                leftSection={<IconUserPlus size="1.2rem" />}
              >
                Create Account
              </Button>
            </Stack>
          </form>
        </Paper>

        <Text c="dimmed" size="sm" ta="center">
          Already have an account?{" "}
          <Text component={Link} href="/login" c="blue" style={{ textDecoration: "none" }}>
            Sign in here
          </Text>
        </Text>
      </Stack>
    </Container>
  );
};

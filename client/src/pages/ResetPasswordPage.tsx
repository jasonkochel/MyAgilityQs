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
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authApi } from "../lib/api";

export const ResetPasswordPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialEmail =
    new URLSearchParams(window.location.search).get("email") ?? "";

  const form = useForm({
    initialValues: {
      email: initialEmail,
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : "Enter a valid email"),
      code: (value) => (value.trim().length >= 4 ? null : "Enter the code from your email"),
      newPassword: (value) => {
        if (!value) return "Password is required";
        if (value.length < 8) return "Password must be at least 8 characters";
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return "Password must contain uppercase, lowercase, and a number";
        }
        return null;
      },
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : "Passwords do not match",
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.confirmForgotPassword({
        email: values.email,
        code: values.code.trim(),
        newPassword: values.newPassword,
      });
      notifications.show({
        title: "Password reset",
        message: "You can now log in with your new password.",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      setLocation("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Stack gap="xl">
        <Stack gap="xs" align="center">
          <Title order={2}>Set a new password</Title>
          <Text c="dimmed" size="sm" ta="center">
            Enter the code from your email and choose a new password.
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="light">
                  {error}
                </Alert>
              )}
              <TextInput
                label="Email"
                required
                autoComplete="email"
                {...form.getInputProps("email")}
              />
              <TextInput
                label="Reset code"
                placeholder="123456"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                {...form.getInputProps("code")}
              />
              <PasswordInput
                label="New password"
                required
                autoComplete="new-password"
                {...form.getInputProps("newPassword")}
              />
              <PasswordInput
                label="Confirm new password"
                required
                autoComplete="new-password"
                {...form.getInputProps("confirmPassword")}
              />
              <Button type="submit" fullWidth size="lg" loading={submitting}>
                Reset password
              </Button>
            </Stack>
          </form>
        </Paper>

        <Text c="dimmed" size="sm" ta="center">
          <Text component={Link} href="/login" c="blue" style={{ textDecoration: "none" }}>
            Back to log in
          </Text>
        </Text>
      </Stack>
    </Container>
  );
};

import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authApi } from "../lib/api";

export const ForgotPasswordPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: "" },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : "Enter a valid email"),
    },
  });

  const handleSubmit = async (values: { email: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword(values.email);
      // Success-shaped response is intentionally generic. Move the user forward
      // to the reset page either way.
      setLocation(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Stack gap="xl">
        <Stack gap="xs" align="center">
          <Title order={2}>Reset your password</Title>
          <Text c="dimmed" size="sm" ta="center">
            Enter your email and we'll send you a code to reset your password.
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
                placeholder="your@email.com"
                required
                autoComplete="email"
                {...form.getInputProps("email")}
              />
              <Button type="submit" fullWidth size="lg" loading={submitting}>
                Send reset code
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

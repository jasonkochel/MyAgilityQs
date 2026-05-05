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
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconCheck, IconMailCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { authApi } from "../lib/api";

export const ConfirmSignupPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const initialEmail =
    new URLSearchParams(window.location.search).get("email") ?? "";

  const form = useForm({
    initialValues: { email: initialEmail, code: "" },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : "Enter a valid email"),
      code: (value) => (value.trim().length >= 4 ? null : "Enter the code from your email"),
    },
  });

  useEffect(() => {
    if (!initialEmail) {
      notifications.show({
        title: "Check your email",
        message: "We sent a verification code to your email. Enter it below to finish signing up.",
        color: "blue",
        icon: <IconMailCheck size="1rem" />,
      });
    }
  }, [initialEmail]);

  const handleSubmit = async (values: { email: string; code: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.confirmSignup({ email: values.email, code: values.code.trim() });
      notifications.show({
        title: "Email verified",
        message: "Your account is ready. Please log in.",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      setLocation("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!form.values.email) {
      setError("Enter your email above first");
      return;
    }
    setResending(true);
    setError(null);
    try {
      await authApi.resendCode(form.values.email);
      notifications.show({
        title: "Code resent",
        message: "Check your email for a new verification code.",
        color: "blue",
        icon: <IconMailCheck size="1rem" />,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Stack gap="xl">
        <Stack gap="xs" align="center">
          <Title order={2}>Verify your email</Title>
          <Text c="dimmed" size="sm" ta="center">
            Enter the 6-digit code we sent to your email.
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
              <TextInput
                label="Verification code"
                placeholder="123456"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                {...form.getInputProps("code")}
              />
              <Button type="submit" fullWidth size="lg" loading={submitting} disabled={resending}>
                Verify
              </Button>
              <Button
                fullWidth
                variant="subtle"
                onClick={handleResend}
                loading={resending}
                disabled={submitting}
              >
                Resend code
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

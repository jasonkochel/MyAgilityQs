import {
  Alert,
  Badge,
  Button,
  Code,
  Collapse,
  Container,
  Divider,
  Group,
  PasswordInput,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Run, ProgressionDiagnostics, DogDiagnostic, ClassDiagnosticDetail, RuleEvaluation } from "@my-agility-qs/shared";
import { IconArrowLeft, IconBug, IconCheck, IconFileImport, IconKey, IconLogout } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import PWAInstallButton from "../components/PWAInstallButton";
import { useAuth } from "../contexts/AuthContext";
import { usePWA } from "../contexts/PWAContext";
import { authApi, progressApi, dogsApi, runsApi } from "../lib/api";

export const ProfilePage: React.FC = () => {
  const [, navigate] = useLocation();
  const { user, logout, updateUserPreferences } = useAuth();
  const { isInstallable, isInstalled } = usePWA();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const passwordForm = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validate: {
      currentPassword: (v) => (v ? null : "Current password is required"),
      newPassword: (v) => {
        if (!v) return "New password is required";
        if (v.length < 8) return "Password must be at least 8 characters";
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(v)) {
          return "Password must contain uppercase, lowercase, and a number";
        }
        return null;
      },
      confirmPassword: (v, values) =>
        v === values.newPassword ? null : "Passwords do not match",
    },
  });

  const handlePasswordSubmit = async (values: typeof passwordForm.values) => {
    setPasswordSubmitting(true);
    setPasswordError(null);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      notifications.show({
        title: "Password changed",
        message: "Your password has been updated.",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      passwordForm.reset();
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Fetch diagnostics via API instead of importing shared functions directly
  const { data: diagnostics, error: diagnosticsError, isLoading: diagnosticsLoading } = useQuery<ProgressionDiagnostics>({
    queryKey: ["progression-diagnostics"],
    queryFn: progressApi.getDiagnostics,
    enabled: showDiagnostics,
    retry: false, // Don't retry if endpoint doesn't exist
  });

  // Fallback: Fetch dogs and runs if diagnostics endpoint fails
  const { data: dogs } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAll,
    enabled: showDiagnostics && !!diagnosticsError,
  });

  const { data: runs } = useQuery({
    queryKey: ["runs"],
    queryFn: runsApi.getAllRuns,
    enabled: showDiagnostics && !!diagnosticsError,
  });

  // Debug logging for diagnostics
  if (showDiagnostics) {
    console.log("Diagnostics state:", { diagnostics, diagnosticsError, diagnosticsLoading });
    console.log("Fallback data:", { dogs, runs });
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Container size="sm" py="md">
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/")}
          w="fit-content"
        >
          Back
        </Button>
        <Title order={1}>Profile</Title>

        <Stack gap="lg">
          <div>
            <Text fw={500}>Email</Text>
            <Text c="dimmed">{user?.email}</Text>
          </div>

          <div>
            <Text fw={500} mb="xs">
              Preferences
            </Text>
            <Switch
              label="Track NQs"
              description="By default, only qualifying runs are tracked. Turn this on to also log non-qualifying runs."
              checked={!(user?.trackQsOnly ?? true)}
              onChange={async (event) => {
                try {
                  // Toggle reads "Track NQs" — inverted from the underlying
                  // `trackQsOnly` field. Checked means we're tracking NQs,
                  // i.e. trackQsOnly is false.
                  await updateUserPreferences({ trackQsOnly: !event.currentTarget.checked });
                  notifications.show({
                    title: "Success",
                    message: "Preference updated successfully",
                    color: "green",
                  });
                } catch {
                  notifications.show({
                    title: "Error",
                    message: "Failed to update preference",
                    color: "red",
                  });
                }
              }}
              color="green"
            />
          </div>

          <div>
            <Text fw={500} mb="xs">
              Change Password
            </Text>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconKey size={16} />}
              onClick={() => {
                setShowPasswordForm((v) => !v);
                setPasswordError(null);
                passwordForm.reset();
              }}
              fullWidth
            >
              {showPasswordForm ? "Cancel" : "Change Password"}
            </Button>
            <Collapse in={showPasswordForm} mt="md">
              <Paper withBorder p="md">
                <form onSubmit={passwordForm.onSubmit(handlePasswordSubmit)}>
                  <Stack gap="md">
                    {passwordError && (
                      <Alert color="red" variant="light">
                        {passwordError}
                      </Alert>
                    )}
                    <PasswordInput
                      label="Current password"
                      required
                      autoComplete="current-password"
                      {...passwordForm.getInputProps("currentPassword")}
                    />
                    <PasswordInput
                      label="New password"
                      required
                      autoComplete="new-password"
                      {...passwordForm.getInputProps("newPassword")}
                    />
                    <PasswordInput
                      label="Confirm new password"
                      required
                      autoComplete="new-password"
                      {...passwordForm.getInputProps("confirmPassword")}
                    />
                    <Button type="submit" loading={passwordSubmitting} leftSection={<IconCheck size={16} />}>
                      Update password
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </Collapse>
          </div>

          <div>
            <Text fw={500} mb="xs">
              Import Data
            </Text>
            <Button
              variant="light"
              leftSection={<IconFileImport size={16} />}
              onClick={() => navigate("/import")}
              fullWidth
            >
              Import Runs from Text
            </Button>
            <Text size="xs" c="dimmed" mt="xs">
              Import historical run data from spreadsheets or other sources
            </Text>
          </div>

          {/* PWA Installation — only render section when actually installable
              (mobile, browser-prompted, not already installed). On desktop the
              entire section is hidden, not just the button. */}
          {isInstallable && !isInstalled && (
            <div>
              <Text fw={500} mb="xs">
                Install App
              </Text>
              <PWAInstallButton compact />
              <Text size="xs" c="dimmed" mt="xs">
                Install MyAgilityQs on your device for quick access and offline use
              </Text>
            </div>
          )}

          {/* Level Progression Diagnostics */}
          <div>
            <Text fw={500} mb="xs">
              Level Progression Diagnostics
            </Text>
            <Button
              variant="light"
              color="orange"
              leftSection={<IconBug size={16} />}
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              fullWidth
            >
              {showDiagnostics ? "Hide" : "Show"} Progression Diagnostics
            </Button>
            <Text size="xs" c="dimmed" mt="xs">
              Developer tool to debug level progression calculations
            </Text>

            <Collapse in={showDiagnostics} mt="md">
              {diagnosticsLoading ? (
                <Paper p="md" withBorder>
                  <Text>Loading diagnostics...</Text>
                </Paper>
              ) : diagnosticsError ? (
                <Paper p="md" withBorder>
                  <Text c="red">Error loading diagnostics: {diagnosticsError?.message || 'Unknown error'}</Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    Check browser console for details
                  </Text>
                </Paper>
              ) : diagnostics && Array.isArray(diagnostics) && diagnostics.length > 0 ? (
                <Stack gap="lg">
                  {diagnostics.map((dogDiag: DogDiagnostic) => (
                    <Paper key={dogDiag.dog.id} p="md" withBorder>
                      <Title order={3} mb="md">
                        {dogDiag.dog.name}
                      </Title>
                      <Text size="sm" c="dimmed" mb="md">
                        Total runs: {dogDiag.dogRuns.length} | Active classes:{" "}
                        {dogDiag.classDetails.length}
                      </Text>

                      {/* Baseline summary — shows where the seeded counts come from */}
                      {dogDiag.dog.baseline && (
                        <Paper p="xs" withBorder mb="md" bg="blue.0">
                          <Text fw={500} size="sm" mb={4}>
                            Baseline (seeded counts)
                          </Text>
                          {dogDiag.dog.baseline.perClass &&
                            Object.entries(dogDiag.dog.baseline.perClass).map(
                              ([cls, b]) =>
                                b && (
                                  <Text key={cls} size="xs">
                                    {cls}:
                                    {b.level && ` level=${b.level}`}
                                    {b.qs !== undefined && ` qs=${b.qs}`}
                                    {b.top25 !== undefined && ` top25=${b.top25}`}
                                  </Text>
                                ),
                            )}
                          {(dogDiag.dog.baseline.machPoints ?? 0) > 0 && (
                            <Text size="xs">
                              MACH points: {dogDiag.dog.baseline.machPoints}
                            </Text>
                          )}
                          {(dogDiag.dog.baseline.doubleQs ?? 0) > 0 && (
                            <Text size="xs">Double Qs: {dogDiag.dog.baseline.doubleQs}</Text>
                          )}
                        </Paper>
                      )}

                      {dogDiag.classDetails.map((classDetail: ClassDiagnosticDetail) => (
                        <div key={classDetail.className} style={{ marginBottom: "24px" }}>
                          <Group mb="sm">
                            <Text fw={600} size="lg">
                              {classDetail.className}
                            </Text>
                            <Badge color={classDetail.result.hasProgressed ? "green" : "gray"}>
                              {classDetail.result.currentLevel}
                            </Badge>
                          </Group>

                          <Text size="sm" mb="xs">
                            <strong>Computed Level:</strong> {classDetail.result.currentLevel} |
                            <strong> Titles:</strong>{" "}
                            {classDetail.result.titlesEarned.join(", ") || "None"} |
                            <strong> Qs at current level:</strong>{" "}
                            {classDetail.result.qualifyingRunsAtCurrentLevel}
                          </Text>

                          <Divider my="sm" />

                          <Text fw={500} size="sm" mb="xs">
                            Rule Evaluations:
                          </Text>
                          <Stack gap="xs" ml="md">
                            {classDetail.ruleEvaluations.map((evaluation: RuleEvaluation, idx: number) => {
                              const loggedQs = evaluation.qualifyingRuns.length;
                              const baselineQs = evaluation.qsAtLevel - loggedQs;
                              return (
                                <Paper
                                  key={idx}
                                  p="xs"
                                  bg={evaluation.satisfied ? "green.0" : "gray.0"}
                                >
                                  <Group>
                                    <Badge size="xs" color={evaluation.satisfied ? "green" : "gray"}>
                                      {evaluation.satisfied ? "✓" : "✗"}
                                    </Badge>
                                    <Text size="xs">
                                      <strong>{evaluation.rule.fromLevel}:</strong>{" "}
                                      {evaluation.qsAtLevel}/{evaluation.rule.qualifyingRunsRequired}{" "}
                                      Qs
                                      {baselineQs > 0 && (
                                        <Text span size="xs" c="dimmed">
                                          {" "}
                                          ({loggedQs} logged + {baselineQs} baseline)
                                        </Text>
                                      )}
                                      {evaluation.rule.toLevel
                                        ? ` → ${evaluation.rule.toLevel}`
                                        : " (stay)"}
                                      {evaluation.rule.titleEarned &&
                                        ` (${evaluation.rule.titleEarned})`}
                                    </Text>
                                  </Group>
                                  {evaluation.qualifyingRuns.length > 0 && (
                                    <Text size="xs" c="dimmed" mt="xs">
                                      Q dates:{" "}
                                      {evaluation.qualifyingRuns
                                        .map((run: Run) => run.date)
                                        .join(", ")}
                                    </Text>
                                  )}
                                </Paper>
                              );
                            })}
                          </Stack>

                          <Divider my="sm" />

                          <Text fw={500} size="sm" mb="xs">
                            All Runs in this Class:
                          </Text>
                          <Code block style={{ fontSize: "10px" }}>
                            {classDetail.classRuns
                              .map(
                                (run: Run) =>
                                  `${run.date} | ${run.level} | ${run.qualified ? "Q" : "NQ"}`
                              )
                              .join("\n") || "No runs in this class"}
                          </Code>
                        </div>
                      ))}

                      <Divider my="md" />
                      <Text fw={500} size="sm" mb="xs">
                        Stored Dog Class Levels:
                      </Text>
                      <Code block style={{ fontSize: "10px" }}>
                        {dogDiag.dog.classes
                          .map((dogClass) => `${dogClass.name}: ${dogClass.level}`)
                          .join("\n")}
                      </Code>
                    </Paper>
                  ))}
                </Stack>
              ) : showDiagnostics ? (
                <Paper p="md" withBorder>
                  <Text c="dimmed">No dogs or runs found for diagnostics.</Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    Debug info: {JSON.stringify({ 
                      hasData: !!diagnostics, 
                      dataType: typeof diagnostics,
                      isArray: Array.isArray(diagnostics),
                      dataLength: Array.isArray(diagnostics) ? diagnostics.length : 'not-array'
                    }, null, 2)}
                  </Text>
                </Paper>
              ) : null}
            </Collapse>
          </div>

          <Group>
            <Button
              variant="outline"
              color="red"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Container>
  );
};

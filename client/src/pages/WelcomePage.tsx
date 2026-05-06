import {
  Alert,
  Button,
  Container,
  Group,
  Paper,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type {
  CompetitionClass,
  CompetitionLevel,
  CreateDogRequest,
  Dog,
  DogClass,
} from "@my-agility-qs/shared";
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconDog,
  IconEdit,
  IconListNumbers,
  IconLogout,
  IconPlus,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { BaselineForm } from "../components/BaselineForm";
import {
  type BaselineFormValues,
  buildBaselineRequest,
  emptyBaselineValues,
} from "../lib/baselineHelpers";
import { useAuth } from "../contexts/AuthContext";
import { dogsApi } from "../lib/api";
import { COMPETITION_CLASSES } from "../lib/constants";

type Step = "tracking" | "add-dog" | "baseline" | "done";

interface DogFormData {
  name: string;
  registeredName: string;
  classSelections: Record<string, { enabled: boolean }>;
}

type BaselineFollowup = "totals" | "runs" | "skip";

export const WelcomePage: React.FC = () => {
  const [, navigate] = useLocation();
  const { user, updateUserPreferences, logout } = useAuth();
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  // Guard: if the user already has dogs, they don't belong here. Dogs
  // cache is warm because AppBootstrap loaded it before this route renders.
  const { data: dogs } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
    staleTime: Infinity,
  });

  const [step, setStep] = useState<Step>("tracking");
  const [trackingChoice, setTrackingChoice] = useState<"qs-only" | "all-runs">(
    user?.trackQsOnly === false ? "all-runs" : "qs-only"
  );
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineValues, setBaselineValues] = useState<BaselineFormValues>(
    emptyBaselineValues(COMPETITION_CLASSES)
  );

  const [error, setError] = useState<string | null>(null);

  const dogForm = useForm<DogFormData>({
    initialValues: {
      name: "",
      registeredName: "",
      classSelections: COMPETITION_CLASSES.reduce((acc, className) => {
        acc[className] = { enabled: false };
        return acc;
      }, {} as Record<string, { enabled: boolean }>),
    },
    validate: {
      name: (value) => (value.trim() ? null : "Call name is required"),
      classSelections: (value) => {
        const enabled = Object.values(value).filter((c) => c.enabled);
        if (enabled.length === 0) {
          return "Pick at least one class";
        }
        return null;
      },
    },
  });

  const enabledClassNames = Object.entries(dogForm.values.classSelections)
    .filter(([, sel]) => sel.enabled)
    .map(([name]) => name);

  const [submitting, setSubmitting] = useState(false);

  const handleTrackingNext = async () => {
    setTrackingError(null);
    const desiredTrackQsOnly = trackingChoice === "qs-only";
    // Only call API if the value actually changed from the user's stored
    // preference. New users default to undefined → trackQsOnly true.
    if ((user?.trackQsOnly ?? true) !== desiredTrackQsOnly) {
      setTrackingSaving(true);
      try {
        await updateUserPreferences({ trackQsOnly: desiredTrackQsOnly });
      } catch {
        setTrackingError("Couldn't save your preference. You can change it later in Profile.");
        setTrackingSaving(false);
        return;
      }
      setTrackingSaving(false);
    }
    setStep("add-dog");
  };

  const handleAddDogNext = () => {
    const result = dogForm.validate();
    if (result.hasErrors) return;
    setStep("baseline");
  };

  const handleBaselineFollowup = async (followup: BaselineFollowup) => {
    setError(null);
    setSubmitting(true);
    const classes: DogClass[] = enabledClassNames.map((className) => ({
      name: className as CompetitionClass,
      level: "Novice" as CompetitionLevel,
    }));
    const baseline =
      followup === "totals"
        ? buildBaselineRequest(baselineValues, enabledClassNames)
        : undefined;
    const registeredName = dogForm.values.registeredName.trim();
    const apiData: CreateDogRequest = {
      name: dogForm.values.name.trim(),
      ...(registeredName ? { registeredName } : {}),
      classes,
      ...(baseline ? { baseline } : {}),
    };
    try {
      const newDog = await dogsApi.create(apiData);
      queryClient.setQueryData<Dog[]>(["dogs"], (old) =>
        old ? [newDog, ...old] : [newDog]
      );
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      notifications.show({
        title: `${newDog.name} added!`,
        message: "Your dog is set up and ready to go.",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      if (followup === "runs") {
        navigate("/add-run");
      } else {
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dog");
      setSubmitting(false);
    }
  };

  const toggleClass = (className: string, enabled: boolean) => {
    dogForm.setFieldValue(`classSelections.${className}.enabled`, enabled);
  };

  if (dogs && dogs.length > 0) {
    return <Redirect to="/" />;
  }

  return (
    <Container size="sm" py="md">
      <Stack gap="lg">
        <Stack align="center" gap="xs">
          <IconDog size={40} color="var(--mantine-color-blue-6)" />
          <Title order={2} c="blue.6" ta="center">
            Welcome to MyAgilityQs
          </Title>
        </Stack>

        {step === "tracking" && (
          <Paper withBorder shadow="sm" p="lg" radius="md">
            <Stack gap="md">
              <Title order={3}>What do you want to track?</Title>
              <Text c="dimmed" size="sm">
                You can change this anytime in Profile.
              </Text>
              {trackingError && (
                <Alert color="red" variant="light">
                  {trackingError}
                </Alert>
              )}
              <Radio.Group
                value={trackingChoice}
                onChange={(v) => setTrackingChoice(v as "qs-only" | "all-runs")}
              >
                <Stack gap="sm">
                  <Radio
                    value="qs-only"
                    label={
                      <Stack gap={2}>
                        <Text fw={500}>Just my qualifying runs (Qs)</Text>
                        <Text size="xs" c="dimmed">
                          Recommended — what most people do.
                        </Text>
                      </Stack>
                    }
                  />
                  <Radio
                    value="all-runs"
                    label={
                      <Stack gap={2}>
                        <Text fw={500}>All my runs, including NQs</Text>
                        <Text size="xs" c="dimmed">
                          Track every run, qualifying or not.
                        </Text>
                      </Stack>
                    }
                  />
                </Stack>
              </Radio.Group>
              <Group justify="flex-end">
                <Button
                  rightSection={<IconArrowRight size={16} />}
                  onClick={handleTrackingNext}
                  loading={trackingSaving}
                  size="md"
                >
                  Continue
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {step === "add-dog" && (
          <Paper withBorder shadow="sm" p="lg" radius="md">
            <Stack gap="md">
              <Title order={3}>Add your first dog</Title>
              <Text c="dimmed" size="sm">
                You can add more dogs later.
              </Text>

              <TextInput
                label="Call Name"
                placeholder="e.g. Bailey"
                required
                {...dogForm.getInputProps("name")}
              />

              <TextInput
                label="AKC Registered Name"
                placeholder="Optional"
                {...dogForm.getInputProps("registeredName")}
              />

              <Stack gap="xs">
                <Text fw={500}>Classes</Text>
                <Text size="sm" c="dimmed">
                  Tap the classes your dog competes in.
                </Text>
                <SimpleGrid cols={2} spacing="xs">
                  {COMPETITION_CLASSES.map((className) => {
                    const enabled = dogForm.values.classSelections[className]?.enabled;
                    return (
                      <Button
                        key={className}
                        variant={enabled ? "filled" : "outline"}
                        color={enabled ? "blue" : "gray"}
                        size="md"
                        h={48}
                        onClick={() => toggleClass(className, !enabled)}
                      >
                        {className}
                      </Button>
                    );
                  })}
                </SimpleGrid>
                {dogForm.errors.classSelections && (
                  <Text c="red" size="sm">
                    {dogForm.errors.classSelections}
                  </Text>
                )}
              </Stack>

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  leftSection={<IconChevronLeft size={16} />}
                  onClick={() => setStep("tracking")}
                >
                  Back
                </Button>
                <Button
                  rightSection={<IconArrowRight size={16} />}
                  onClick={handleAddDogNext}
                  size="md"
                >
                  Continue
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {step === "baseline" && (
          <Paper withBorder shadow="sm" p="lg" radius="md">
            <Stack gap="md">
              <Title order={3}>Already been competing?</Title>
              <Text size="sm">
                If {dogForm.values.name.trim() || "your dog"} already has Qs from before,
                you can pick up where you actually are. How would you like to handle that?
              </Text>
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}

              {!showBaselineForm ? (
                <Stack gap="sm">
                  <Button
                    variant="filled"
                    color="blue"
                    size="lg"
                    leftSection={<IconListNumbers size={20} />}
                    onClick={() => setShowBaselineForm(true)}
                    styles={{
                      inner: { justifyContent: "flex-start" },
                      label: { flex: 1, textAlign: "left" },
                    }}
                  >
                    <Stack gap={0} align="flex-start">
                      <Text fw={600} size="md" c="white">
                        Enter my Q totals
                      </Text>
                      <Text size="xs" c="white" opacity={0.9}>
                        Fastest if you have a lot of past Qs
                      </Text>
                    </Stack>
                  </Button>
                  <Button
                    variant="light"
                    color="teal"
                    size="lg"
                    leftSection={<IconEdit size={20} />}
                    onClick={() => handleBaselineFollowup("runs")}
                    loading={submitting}
                    styles={{
                      inner: { justifyContent: "flex-start" },
                      label: { flex: 1, textAlign: "left" },
                    }}
                  >
                    <Stack gap={0} align="flex-start">
                      <Text fw={600} size="md">
                        Enter my runs one at a time
                      </Text>
                      <Text size="xs" opacity={0.8}>
                        Best if you only have a few — start adding runs now
                      </Text>
                    </Stack>
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => handleBaselineFollowup("skip")}
                    loading={submitting}
                    styles={{
                      inner: { justifyContent: "flex-start" },
                      label: { flex: 1, textAlign: "left" },
                    }}
                  >
                    <Stack gap={0} align="flex-start">
                      <Text fw={600} size="md">
                        Skip — start fresh
                      </Text>
                      <Text size="xs" c="dimmed">
                        Brand new? Pick this.
                      </Text>
                    </Stack>
                  </Button>
                  <Group justify="flex-start" mt="xs">
                    <Button
                      variant="subtle"
                      leftSection={<IconChevronLeft size={16} />}
                      onClick={() => setStep("add-dog")}
                    >
                      Back
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    Enter your current totals in each class. Leave anything blank if it
                    doesn't apply.
                  </Text>
                  <BaselineForm
                    enabledClasses={enabledClassNames}
                    values={baselineValues}
                    onChange={setBaselineValues}
                  />
                  <Group justify="space-between">
                    <Button
                      variant="subtle"
                      leftSection={<IconChevronLeft size={16} />}
                      onClick={() => setShowBaselineForm(false)}
                    >
                      Back
                    </Button>
                    <Button
                      leftSection={<IconCheck size={16} />}
                      onClick={() => handleBaselineFollowup("totals")}
                      size="md"
                    >
                      Save and continue
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Paper>
        )}

        {step === "done" && (
          <Paper withBorder shadow="sm" p="lg" radius="md">
            <Stack gap="md" align="center">
              <IconCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>You're all set!</Title>
              <Text ta="center">Do you have another dog to add?</Text>
              <Group grow w="100%">
                <Button
                  variant="filled"
                  size="md"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate("/dogs")}
                >
                  Yes, add another
                </Button>
                <Button
                  variant="light"
                  size="md"
                  onClick={() => navigate("/")}
                >
                  No, take me to the app
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {/* Escape hatch — visible on every step. New users who landed
            here by accident or want to come back later can bail out. */}
        {step !== "done" && (
          <Group justify="center">
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconLogout size={16} />}
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
  );
};

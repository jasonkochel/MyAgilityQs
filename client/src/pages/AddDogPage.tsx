import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
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
  DogClass,
} from "@my-agility-qs/shared";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { BaselineForm } from "../components/BaselineForm";
import {
  type BaselineFormValues,
  buildBaselineRequest,
  emptyBaselineValues,
} from "../lib/baselineHelpers";
import { dogsApi } from "../lib/api";
import { COMPETITION_CLASSES } from "../lib/constants";

interface DogFormData {
  name: string;
  registeredName: string;
  classSelections: Record<string, { enabled: boolean }>;
  baselineEnabled: boolean;
  baseline: BaselineFormValues;
}

export const AddDogPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm<DogFormData>({
    initialValues: {
      name: "",
      registeredName: "",
      classSelections: COMPETITION_CLASSES.reduce((acc, className) => {
        acc[className] = { enabled: false };
        return acc;
      }, {} as Record<string, { enabled: boolean }>),
      baselineEnabled: false,
      baseline: emptyBaselineValues(COMPETITION_CLASSES),
    },
    validate: {
      name: (value) => (value.trim() ? null : "Call name is required"),
      classSelections: (value) => {
        const enabledClasses = Object.values(value).filter((c) => c.enabled);
        if (enabledClasses.length === 0) {
          return "At least one class must be selected";
        }
        return null;
      },
    },
  });

  const createDogMutation = useMutation({
    mutationFn: dogsApi.create,
    onSuccess: (newDog) => {
      queryClient.setQueryData<typeof newDog[]>(["dogs"], (old) =>
        old ? [newDog, ...old] : [newDog]
      );
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      notifications.show({
        title: "Success!",
        message: "Dog added successfully",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      navigate("/dogs");
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : "Failed to add dog";
      setError(errorMessage);
    },
  });

  const handleSubmit = (values: DogFormData) => {
    setError(null);
    const enabledClassNames = Object.entries(values.classSelections)
      .filter(([, selection]) => selection.enabled)
      .map(([className]) => className);

    // Server seeds level from baseline (or defaults to Novice). Send a
    // placeholder level — server overrides during creation.
    const classes: DogClass[] = enabledClassNames.map((className) => ({
      name: className as CompetitionClass,
      level: "Novice" as CompetitionLevel,
    }));

    const baseline = values.baselineEnabled
      ? buildBaselineRequest(values.baseline, enabledClassNames)
      : undefined;

    const registeredName = values.registeredName.trim();
    const apiData: CreateDogRequest = {
      name: values.name.trim(),
      ...(registeredName ? { registeredName } : {}),
      classes,
      ...(baseline ? { baseline } : {}),
    };
    createDogMutation.mutate(apiData);
  };

  const toggleClass = (className: string, enabled: boolean) => {
    form.setFieldValue(`classSelections.${className}.enabled`, enabled);
  };

  const enabledClasses = COMPETITION_CLASSES.filter(
    (cls) => form.values.classSelections[cls]?.enabled
  );

  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/dogs")}
            size="sm"
          >
            Back
          </Button>
          <Title
            order={3}
            style={{
              margin: 0,
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            Add New Dog
          </Title>
          <div></div>
        </Group>

        <Paper withBorder shadow="sm" p="md" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              {/* Call Name */}
              <TextInput
                label="Call Name"
                placeholder="Enter your dog's call name"
                required
                {...form.getInputProps("name")}
              />

              {/* AKC Registered Name */}
              <TextInput
                label="AKC Registered Name"
                placeholder="Enter your dog's AKC registered name (optional)"
                {...form.getInputProps("registeredName")}
              />

              {/* Classes */}
              <Stack gap="xs">
                <Text fw={500}>Classes</Text>
                <Text size="sm" c="dimmed">
                  Tap the classes your dog competes in. New dogs start at Novice;
                  enter your current totals below if you're already competing.
                </Text>
                <SimpleGrid cols={2} spacing="xs">
                  {COMPETITION_CLASSES.map((className) => {
                    const enabled = form.values.classSelections[className]?.enabled;
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
                {form.errors.classSelections && (
                  <Text c="red" size="sm">
                    {form.errors.classSelections}
                  </Text>
                )}
              </Stack>

              <Divider my="xs" />

              {/* Starting Counts (Baseline) */}
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={0}>
                    <Text fw={500}>Starting Counts</Text>
                    <Text size="sm" c="dimmed">
                      Already competing? Enter your current level and Qs in each class.
                    </Text>
                  </Stack>
                  <Switch
                    checked={form.values.baselineEnabled}
                    onChange={(e) =>
                      form.setFieldValue("baselineEnabled", e.currentTarget.checked)
                    }
                    color="blue"
                  />
                </Group>

                {form.values.baselineEnabled && (
                  <BaselineForm
                    enabledClasses={enabledClasses}
                    values={form.values.baseline}
                    onChange={(v) => form.setFieldValue("baseline", v)}
                  />
                )}
              </Stack>

              {/* Submit Button */}
              <Button
                type="submit"
                leftSection={<IconCheck size={16} />}
                loading={createDogMutation.isPending}
                size="lg"
              >
                Add Dog
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
};

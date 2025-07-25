import {
  Alert,
  Button,
  Container,
  Group,
  Paper,
  Select,
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
import { dogsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES, COMPETITION_CLASSES, COMPETITION_LEVELS } from "../lib/constants";

interface DogFormData {
  name: string;
  classSelections: Record<string, { enabled: boolean; level: string }>;
}

export const AddDogPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm<DogFormData>({
    initialValues: {
      name: "",
      classSelections: COMPETITION_CLASSES.reduce((acc, className) => {
        acc[className] = { enabled: false, level: "" };
        return acc;
      }, {} as Record<string, { enabled: boolean; level: string }>),
    },
    validate: {
      name: (value) => (value.trim() ? null : "Dog name is required"),
      classSelections: (value) => {
        const enabledClasses = Object.values(value).filter((c) => c.enabled);
        if (enabledClasses.length === 0) {
          return "At least one class must be selected";
        }
        const missingLevels = enabledClasses.filter((c) => !c.level);
        if (missingLevels.length > 0) {
          return "All selected classes must have a level";
        }
        return null;
      },
    },
  });

  const createDogMutation = useMutation({
    mutationFn: dogsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
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
    setError(null); // Convert classSelections back to DogClass array using display names
    const classes: DogClass[] = Object.entries(values.classSelections)
      .filter(([, selection]) => selection.enabled)
      .map(([className, selection]) => ({
        name: CLASS_DISPLAY_NAMES[className] as CompetitionClass, // Use full display name for API
        level: selection.level as CompetitionLevel,
      }));

    const apiData: CreateDogRequest = {
      name: values.name.trim(),
      classes,
    };
    createDogMutation.mutate(apiData);
  };
  const toggleClass = (className: string, enabled: boolean) => {
    form.setFieldValue(`classSelections.${className}.enabled`, enabled);
    if (!enabled) {
      // Clear level when disabling a class
      form.setFieldValue(`classSelections.${className}.level`, "");
    }
  };

  const updateClassLevel = (className: string, level: string) => {
    form.setFieldValue(`classSelections.${className}.level`, level);
  };

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
              {/* Dog Name */}
              <TextInput
                label="Dog Name"
                placeholder="Enter your dog's name"
                required
                {...form.getInputProps("name")}
              />{" "}
              {/* Classes */}
              <Stack gap="xs">
                <Text fw={500}>Classes & Levels</Text>
                <Text size="sm" c="dimmed">
                  Toggle on the classes your dog competes in and select their level
                </Text>{" "}
                <Stack gap="sm">
                  {COMPETITION_CLASSES.map((className) => {
                    const selection = form.values.classSelections[className];
                    return (
                      <Group key={className} align="center" gap="md" wrap="nowrap">
                        <Switch
                          checked={selection.enabled}
                          onChange={(event) => toggleClass(className, event.currentTarget.checked)}
                          color="blue"
                          style={{ flexShrink: 0 }}
                        />
                        <Text
                          fw={500}
                          style={{ flexShrink: 0, minWidth: "90px", fontSize: "14px" }}
                        >
                          {className}
                        </Text>
                        {selection.enabled && (
                          <Select
                            placeholder="Level"
                            data={COMPETITION_LEVELS}
                            value={selection.level}
                            onChange={(value) => updateClassLevel(className, value || "")}
                            style={{ flexShrink: 0, minWidth: "100px" }}
                            size="sm"
                            required
                          />
                        )}
                      </Group>
                    );
                  })}
                </Stack>
                {form.errors.classSelections && (
                  <Text c="red" size="sm">
                    {form.errors.classSelections}
                  </Text>
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

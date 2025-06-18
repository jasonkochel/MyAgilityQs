import {
  Alert,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { dogsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES, COMPETITION_LEVELS } from "../lib/constants";
import type { CreateRunRequest, Dog } from "../types";

// AKC Agility Classes and Levels - use shared constants
const AKC_CLASS_MAPPING = CLASS_DISPLAY_NAMES;

const AKC_LEVELS = COMPETITION_LEVELS; // Reordered highest to lowest

const PLACEMENT_OPTIONS = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "X", value: undefined }, // Changed from "None" to "X"
];

interface RunFormData {
  dogId: string;
  className: string;
  level: string;
  date: string; // Changed to string for new Mantine DateInput
  qualified: boolean;
  placement?: number;
  notes: string;
}

export const AddRunPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  // Fetch user's dogs
  const { data: dogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });
  const form = useForm<RunFormData>({
    initialValues: {
      dogId: "",
      className: "",
      level: "",
      date: new Date().toISOString().split("T")[0], // Today's date as YYYY-MM-DD string
      qualified: true, // Default to qualified
      placement: undefined, // Default to None
      notes: "",
    },
    validate: {
      dogId: (value) => (value ? null : "Please select a dog"),
      className: (value) => (value ? null : "Please select a class"),
      level: (value) => (value ? null : "Please select a level"),
      date: (value) => (value ? null : "Please select a date"),
    },
  });

  const createRunMutation = useMutation({
    mutationFn: runsApi.createRun,
    onSuccess: () => {
      notifications.show({
        title: "Success!",
        message: "Run added successfully",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      setLocation("/view-runs");
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : "Failed to add run";
      setError(errorMessage);
    },
  });

  const handleSubmit = (values: RunFormData) => {
    setError(null);

    // Convert form data to API format
    const apiData: CreateRunRequest = {
      dogId: values.dogId,
      class: values.className,
      level: values.level,
      date: values.date, // Already in YYYY-MM-DD string format
      qualified: values.qualified,
      placement: values.placement,
      notes: values.notes,
    };

    createRunMutation.mutate(apiData);
  };

  if (dogsLoading) {
    return (
      <Container size="sm" py="md">
        <Text>Loading dogs...</Text>
      </Container>
    );
  }
  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setLocation("/")}
            w="fit-content"
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
            Add New Run
          </Title>
        </Group>
        <Paper withBorder shadow="sm" p="md" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              {/* Date First */}
              <Stack gap="xs">
                <Text fw={500}>Date</Text>{" "}
                <DateInput
                  placeholder="Select date"
                  value={form.values.date}
                  onChange={(date) => {
                    if (date) {
                      // DateInput now returns a string in YYYY-MM-DD format
                      form.setFieldValue("date", date);
                    }
                  }}
                  error={form.errors.date}
                  size="lg"
                />
              </Stack>{" "}
              {/* Dog Selection - Large Touch-Friendly Buttons */}
              <Stack gap="xs">
                <Text fw={500}>Select Dog</Text>
                <SimpleGrid cols={2} spacing="xs">
                  {dogs.map((dog: Dog) => (
                    <Button
                      key={dog.id}
                      variant={form.values.dogId === dog.id ? "filled" : "outline"}
                      color={form.values.dogId === dog.id ? "blue" : "gray"}
                      size="lg"
                      h={50}
                      onClick={() => {
                        form.setFieldValue("dogId", dog.id);
                        // Auto-select level based on dog's class level
                        if (form.values.className && dog.classes) {
                          const dogClass = dog.classes.find(
                            (c) => c.name === form.values.className
                          );
                          if (dogClass && dogClass.level) {
                            form.setFieldValue("level", dogClass.level);
                          }
                        }
                      }}
                    >
                      <Text fw={600} size="md">
                        {dog.name}
                      </Text>
                    </Button>
                  ))}
                </SimpleGrid>
                {form.errors.dogId && (
                  <Text c="red" size="sm">
                    {form.errors.dogId}
                  </Text>
                )}
              </Stack>{" "}
              {/* Class Selection - Large Touch-Friendly Buttons */}
              <Stack gap="xs">
                <Text fw={500}>Select Class</Text>
                {!form.values.dogId ? (
                  <Text size="sm" c="dimmed">
                    Please select a dog first
                  </Text>
                ) : (
                  <SimpleGrid cols={2} spacing="xs">
                    {(() => {
                      const selectedDog = dogs.find((d) => d.id === form.values.dogId);
                      if (!selectedDog || !selectedDog.classes) return null;

                      // Get available classes for this dog and map to display names
                      const availableClasses = selectedDog.classes
                        .map((dogClass) => {
                          // Find the display name for this actual class name
                          const displayName = Object.keys(AKC_CLASS_MAPPING).find(
                            (key) =>
                              AKC_CLASS_MAPPING[key as keyof typeof AKC_CLASS_MAPPING] ===
                              dogClass.name
                          );
                          return displayName ? { displayName, actualName: dogClass.name } : null;
                        })
                        .filter(Boolean);

                      return availableClasses.map((classInfo) => {
                        if (!classInfo) return null;
                        return (
                          <Button
                            key={classInfo.displayName}
                            variant={
                              form.values.className === classInfo.actualName ? "filled" : "outline"
                            }
                            color={form.values.className === classInfo.actualName ? "blue" : "gray"}
                            size="lg"
                            h={50}
                            onClick={() => {
                              form.setFieldValue("className", classInfo.actualName);
                              // Auto-select level based on dog's class level
                              const selectedDog = dogs.find((d) => d.id === form.values.dogId);
                              if (selectedDog && selectedDog.classes) {
                                const dogClass = selectedDog.classes.find(
                                  (c) => c.name === classInfo.actualName
                                );
                                if (dogClass && dogClass.level) {
                                  form.setFieldValue("level", dogClass.level);
                                }
                              }
                            }}
                          >
                            {classInfo.displayName}
                          </Button>
                        );
                      });
                    })()}
                  </SimpleGrid>
                )}
                {form.errors.className && (
                  <Text c="red" size="sm">
                    {form.errors.className}
                  </Text>
                )}
              </Stack>
              {/* Level Selection - Large Touch-Friendly Buttons */}
              <Stack gap="xs">
                <Text fw={500}>Select Level</Text>
                <SimpleGrid cols={2} spacing="xs">
                  {AKC_LEVELS.map((level) => (
                    <Button
                      key={level}
                      variant={form.values.level === level ? "filled" : "outline"}
                      color={form.values.level === level ? "blue" : "gray"}
                      size="lg"
                      h={50}
                      onClick={() => form.setFieldValue("level", level)}
                    >
                      {level}
                    </Button>
                  ))}
                </SimpleGrid>
                {form.errors.level && (
                  <Text c="red" size="sm">
                    {form.errors.level}
                  </Text>
                )}
              </Stack>{" "}
              {/* Qualified/Not Qualified Toggle */}
              <Stack gap="xs">
                <Text fw={500}>Result</Text>
                <Group>
                  <Button
                    variant={form.values.qualified ? "filled" : "outline"}
                    color={form.values.qualified ? "green" : "gray"}
                    size="lg"
                    onClick={() => form.setFieldValue("qualified", true)}
                    flex={1}
                  >
                    Qualified
                  </Button>
                  <Button
                    variant={!form.values.qualified ? "filled" : "outline"}
                    color={!form.values.qualified ? "red" : "gray"}
                    size="lg"
                    onClick={() => form.setFieldValue("qualified", false)}
                    flex={1}
                  >
                    NQ
                  </Button>
                </Group>
              </Stack>
              {/* Placement Selection - Touch-Friendly Buttons */}{" "}
              <Stack gap="xs">
                <Text fw={500}>Placement</Text>
                <SimpleGrid cols={5} spacing="xs">
                  {PLACEMENT_OPTIONS.map((option) => (
                    <Button
                      key={option.label}
                      variant={form.values.placement === option.value ? "filled" : "outline"}
                      color={form.values.placement === option.value ? "blue" : "gray"}
                      size="md"
                      h={44}
                      onClick={() => form.setFieldValue("placement", option.value)}
                      styles={{
                        inner: { padding: "2px" },
                        label: { fontSize: "16px", fontWeight: 600 },
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </SimpleGrid>
              </Stack>
              {/* Notes */}
              <Stack gap="xs">
                <Text fw={500}>Notes (Optional)</Text>
                <Textarea
                  placeholder="Add any notes about this run..."
                  rows={3}
                  {...form.getInputProps("notes")}
                />
              </Stack>
              {/* Submit Button */}
              <Button
                type="submit"
                size="xl"
                h={60}
                loading={createRunMutation.isPending}
                leftSection={<IconCheck size={20} />}
                color="blue"
              >
                Add Run
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
};

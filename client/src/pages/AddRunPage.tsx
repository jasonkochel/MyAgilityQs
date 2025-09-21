import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type {
  CompetitionClass,
  CompetitionLevel,
  CreateRunRequest,
  Dog,
} from "@my-agility-qs/shared";
import { IconArrowLeft, IconCheck, IconTrophy, IconDog } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { dogsApi, locationsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";

// AKC Agility Classes - use shared constants
const AKC_CLASS_MAPPING = CLASS_DISPLAY_NAMES;


const PLACEMENT_OPTIONS = [
  { label: "1", value: 1, color: "blue" }, // Blue ribbon
  { label: "2", value: 2, color: "red" }, // Red ribbon
  { label: "3", value: 3, color: "yellow" }, // Yellow ribbon
  { label: "4", value: 4, color: "gray.3" }, // White ribbon (light gray for visibility)
  { label: "X", value: undefined, color: "gray.7" }, // No placement (dark gray)
];

interface RunFormData {
  dogId: string;
  className: string;
  level: string;
  date: string; // Changed to string for new Mantine DateInput
  qualified: boolean;
  placement?: number;
  machPoints?: number;
  location: string;
  notes: string;
}

export const AddRunPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch user's dogs and filter to only active ones
  const { data: allDogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });
  // Fetch unique locations from user's runs for autocomplete
  const { data: locationSuggestions = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsApi.getAll,
    staleTime: Infinity, // Always fresh - preloaded on login, invalidated on changes
  });

  // Filter to only show active dogs for run entry
  const dogs = allDogs.filter((dog) => dog.active);
  const form = useForm<RunFormData>({
    initialValues: {
      dogId: "",
      className: "",
      level: "",
      date: new Date().toISOString().split("T")[0], // Today's date as YYYY-MM-DD string
      qualified: true, // Default to qualified
      placement: undefined, // Default to None
      machPoints: undefined,
      location: "",
      notes: "",
    },
    validate: {
      dogId: (value) => (value ? null : "Please select a dog"),
      className: (value) => (value ? null : "Please select a class"),
      date: (value) => (value ? null : "Please select a date"),
    },
  });
  const createRunMutation = useMutation({
    mutationFn: runsApi.createRun,
    onSuccess: async (response, variables) => {
      // Invalidate caches to refresh data when pages are next visited
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });

      // If there was a level progression, invalidate dogs cache to refresh My Dogs page
      if (response.meta?.levelProgression) {
        queryClient.invalidateQueries({ queryKey: ["dogs"] });
      }

      // Only invalidate locations if a new location was added
      if (
        variables.location &&
        variables.location.trim() &&
        !locationSuggestions.includes(variables.location.trim())
      ) {
        queryClient.invalidateQueries({ queryKey: ["locations"] });
      } // Show success notification with progression info if applicable
      const levelProgression = response.meta?.levelProgression;
      const isProgression = !!levelProgression;

      notifications.show({
        title: isProgression ? "🎉 Level Up!" : "Success!",
        message:
          isProgression && levelProgression
            ? `${levelProgression.dogName} advanced from ${levelProgression.fromLevel} to ${levelProgression.toLevel} in ${levelProgression.class}!`
            : "Run added successfully",
        color: isProgression ? "yellow" : "green",
        icon: isProgression ? <IconTrophy size="1rem" /> : <IconCheck size="1rem" />,
        autoClose: isProgression ? 8000 : 4000, // Show progression longer
      });
      navigate("/");
    },
    onError: (err) => {
      console.error("AddRunPage - error creating run:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add run";
      setError(errorMessage);
    },
  });
  const handleSubmit = (values: RunFormData) => {
    setError(null); // Convert form data to API format
    const apiData: CreateRunRequest = {
      dogId: values.dogId,
      class: values.className as CompetitionClass,
      level: values.level as CompetitionLevel,
      date: values.date, // Already in YYYY-MM-DD string format
      qualified: values.qualified,
      placement: values.placement,
      machPoints: values.machPoints,
      location: values.location,
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
            onClick={() => navigate('/')}
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
                <Text fw={500}>Date</Text>
                <TextInput
                  type="date"
                  value={form.values.date}
                  onChange={(event) => {
                    form.setFieldValue("date", event.currentTarget.value);
                  }}
                  error={form.errors.date}
                  size="lg"
                />
              </Stack>
              {/* Dog Selection - Large Touch-Friendly Buttons */}
              <Stack gap="xs">
                <Text fw={500}>Select Dog</Text>
                {dogs.length === 0 ? (
                  <Paper withBorder p="md" radius="md">
                    <Stack align="center" gap="xs">
                      <Text c="dimmed" size="sm">
                        No active dogs available
                      </Text>
                      <Button variant="outline" size="sm" onClick={() => navigate("/my-dogs")}>
                        Manage Dogs
                      </Button>
                    </Stack>
                  </Paper>
                ) : (
                  <SimpleGrid cols={2} spacing="xs">
                    {dogs.map((dog: Dog) => (
                      <Box
                        key={dog.id}
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
                        style={{
                          height: '80px',
                          borderRadius: 'var(--mantine-radius-md)',
                          border: form.values.dogId === dog.id 
                            ? '2px solid var(--mantine-color-blue-filled)' 
                            : '1px solid var(--mantine-color-gray-4)',
                          backgroundColor: form.values.dogId === dog.id 
                            ? 'var(--mantine-color-blue-filled)' 
                            : 'var(--mantine-color-white)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'stretch',
                          transition: 'all 0.2s ease',
                        }}
                        __vars={{
                          '--button-hover': form.values.dogId === dog.id 
                            ? 'var(--mantine-color-blue-6)' 
                            : 'var(--mantine-color-gray-0)',
                        }}
                        onMouseEnter={(e) => {
                          if (form.values.dogId !== dog.id) {
                            e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (form.values.dogId !== dog.id) {
                            e.currentTarget.style.backgroundColor = 'var(--mantine-color-white)';
                          }
                        }}
                      >
                        {/* Photo - flush left, natural width */}
                        {dog.photoUrl ? (
                          <img
                            src={dog.photoUrl}
                            alt={`${dog.name} photo`}
                            style={{
                              height: '80px',
                              width: 'auto', // This will maintain aspect ratio
                              objectFit: 'cover',
                              objectPosition: 'center',
                              flexShrink: 0,
                              display: 'block',
                            }}
                          />
                        ) : (
                          <Box
                            w={80} // Fallback square for icon
                            h="100%"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'var(--mantine-color-gray-1)',
                              flexShrink: 0,
                            }}
                          >
                            <IconDog size={32} color="var(--mantine-color-gray-6)" />
                          </Box>
                        )}
                        
                        {/* Name - centered in remaining space */}
                        <Box
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                          }}
                        >
                          <Text 
                            fw={600} 
                            size="md" 
                            ta="center"
                            c={form.values.dogId === dog.id ? 'white' : 'black'}
                          >
                            {dog.name}
                          </Text>
                        </Box>
                      </Box>
                    ))}
                  </SimpleGrid>
                )}
                {form.errors.dogId && (
                  <Text c="red" size="sm">
                    {form.errors.dogId}
                  </Text>
                )}
              </Stack>{" "}
              {/* Only show remaining fields after dog is selected */}
              {form.values.dogId && (
                <>
                  {/* Class Selection - Smart Class/Level Buttons */}
                  <Stack gap="xs">
                    <Text fw={500}>Select Class</Text>
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
                            return displayName
                              ? {
                                  displayName,
                                  actualName: dogClass.name,
                                  level: dogClass.level,
                                }
                              : null;
                          })
                          .filter(Boolean);

                        return availableClasses.map((classInfo) => {
                          if (!classInfo) return null;
                          return (
                            <Button
                              key={classInfo.displayName}
                              variant={
                                form.values.className === classInfo.actualName
                                  ? "filled"
                                  : "outline"
                              }
                              color={
                                form.values.className === classInfo.actualName ? "blue" : "gray"
                              }
                              size="lg"
                              h={60}
                              onClick={() => {
                                form.setFieldValue("className", classInfo.actualName);
                                // Auto-select level based on dog's class level
                                form.setFieldValue("level", classInfo.level);
                              }}
                            >
                              {" "}
                              <Stack gap={2} align="center">
                                <Text fw={600} size="md">
                                  {classInfo.displayName}
                                </Text>
                                <Text
                                  size="xs"
                                  fw={500}
                                  c={
                                    form.values.className === classInfo.actualName
                                      ? "white"
                                      : "dimmed"
                                  }
                                >
                                  {classInfo.level}
                                </Text>
                              </Stack>
                            </Button>
                          );
                        });
                      })()}
                    </SimpleGrid>
                    {form.errors.className && (
                      <Text c="red" size="sm">
                        {form.errors.className}
                      </Text>
                    )}
                  </Stack>

                  {/* Qualified/Not Qualified Toggle - Only show if user is not tracking Qs only */}
                  {!user?.trackQsOnly && (
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
                          onClick={() => {
                            form.setFieldValue("qualified", false);
                            // Clear placement when NQ is selected since you can't place if you don't qualify
                            form.setFieldValue("placement", undefined);
                          }}
                          flex={1}
                        >
                          NQ
                        </Button>
                      </Group>
                    </Stack>
                  )}

                  {/* Placement Selection - Show when qualified OR when tracking Qs only */}
                  {(form.values.qualified || user?.trackQsOnly) && (
                    <Stack gap="xs">
                      <Text fw={500}>Placement</Text>
                      <SimpleGrid cols={5} spacing="xs">
                        {PLACEMENT_OPTIONS.map((option) => (
                          <Button
                            key={option.label}
                            variant={form.values.placement === option.value ? "filled" : "outline"}
                            color={form.values.placement === option.value ? option.color : "gray"}
                            size="lg"
                            h={56}
                            onClick={() => form.setFieldValue("placement", option.value)}
                            styles={{
                              inner: { padding: "4px" },
                              label: { fontSize: "18px", fontWeight: 600 },
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  )}

                  {/* MACH Points - Only show for qualified Masters Standard/Jumpers */}
                  {(form.values.qualified || user?.trackQsOnly) &&
                    form.values.level === "Masters" &&
                    (form.values.className === "Standard" ||
                      form.values.className === "Jumpers") && (
                      <Stack gap="xs">
                        <Text fw={500}>MACH Points</Text>
                        <NumberInput
                          placeholder="Enter MACH points earned"
                          min={0}
                          max={50}
                          {...form.getInputProps("machPoints")}
                          size="lg"
                        />
                      </Stack>
                    )}

                  {/* Location */}
                  <Stack gap="xs">
                    <Text fw={500}>Location</Text>
                    <Autocomplete
                      data={locationSuggestions}
                      {...form.getInputProps("location")}
                      size="lg"
                    />
                  </Stack>

                  {/* Notes */}
                  <Stack gap="xs">
                    <Text fw={500}>Notes</Text>
                    <Textarea
                      placeholder="Add any notes about this run..."
                      rows={3}
                      {...form.getInputProps("notes")}
                    />
                  </Stack>
                </>
              )}{" "}
              {/* Submit Button - Only show when dog is selected */}
              {form.values.dogId && (
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
              )}
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
};

import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type {
  CompetitionClass,
  CompetitionLevel,
  DogClass,
  UpdateDogRequest,
} from "@my-agility-qs/shared";
import { IconArrowLeft, IconCheck, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { dogsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES, COMPETITION_CLASSES, COMPETITION_LEVELS } from "../lib/constants";

interface DogFormData {
  name: string;
  registeredName: string;
  classSelections: Record<string, { enabled: boolean; level: string }>;
  active: boolean;
}

export const EditDogPage: React.FC = () => {
  const [, navigate] = useLocation();
  const { dogId } = useParams<{ dogId: string }>();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: dog,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["dogs", dogId],
    queryFn: () => dogsApi.getById(dogId!),
    enabled: !!dogId,
  });
  const form = useForm<DogFormData>({
    initialValues: {
      name: "",
      registeredName: "",
      classSelections: COMPETITION_CLASSES.reduce((acc, className) => {
        acc[className] = { enabled: false, level: "" };
        return acc;
      }, {} as Record<string, { enabled: boolean; level: string }>),
      active: true,
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
  }); // Update form when dog data loads
  useEffect(() => {
    if (dog) {
      const classSelections = COMPETITION_CLASSES.reduce((acc, className) => {
        // Find matching dog class by display name
        const displayName = CLASS_DISPLAY_NAMES[className];
        const dogClass = dog.classes?.find((c) => c.name === displayName);
        acc[className] = {
          enabled: !!dogClass,
          level: dogClass?.level || "",
        };
        return acc;
      }, {} as Record<string, { enabled: boolean; level: string }>);

      form.setValues({
        name: dog.name,
        registeredName: dog.registeredName || "",
        classSelections,
        active: dog.active,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog]);

  const updateDogMutation = useMutation({
    mutationFn: ({ dogId, data }: { dogId: string; data: UpdateDogRequest }) =>
      dogsApi.update(dogId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      notifications.show({
        title: "Success!",
        message: "Dog updated successfully",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      navigate("/my-dogs");
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : "Failed to update dog";
      setError(errorMessage);
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: dogsApi.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      notifications.show({
        title: "Success",
        message: "Dog has been permanently deleted",
        color: "green",
      });
      navigate("/my-dogs");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete dog";
      setError(errorMessage);
    },
  });
  const handleSubmit = (values: DogFormData) => {
    if (!dogId) return;

    setError(null); // Convert classSelections back to DogClass array using display names
    const classes: DogClass[] = Object.entries(values.classSelections)
      .filter(([, selection]) => selection.enabled)
      .map(([className, selection]) => ({
        name: CLASS_DISPLAY_NAMES[className] as CompetitionClass, // Use full display name for API
        level: selection.level as CompetitionLevel,
      }));

    const apiData: UpdateDogRequest = {
      name: values.name.trim(),
      registeredName: values.registeredName.trim() || undefined,
      classes,
      active: values.active,
    };
    updateDogMutation.mutate({ dogId, data: apiData });
  };

  const handleHardDelete = () => {
    if (!dog || !dogId) return;
    
    modals.openConfirmModal({
      title: "Permanently Delete Dog",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to permanently delete <strong>{dog.name}</strong>?
          </Text>
          <Text size="sm" c="orange">
            <strong>Warning:</strong> This action cannot be undone. All runs associated with this
            dog will also be permanently deleted.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Delete Permanently", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => hardDeleteMutation.mutate(dogId),
    });
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

  if (isLoading) {
    return (
      <Container size="sm" py="md">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text>Loading dog details...</Text>
        </Stack>
      </Container>
    );
  }

  if (fetchError || !dog) {
    return (
      <Container size="sm" py="md">
        <Stack>
          <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate("/my-dogs")}
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
              Edit Dog
            </Title>
            <div></div>
          </Group>
          <Alert color="red" variant="light">
            Dog not found or error loading dog details.
          </Alert>
        </Stack>
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
            onClick={() => navigate("/my-dogs")}
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
            Edit {dog.name}
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
                label="Call Name"
                placeholder="Enter your dog's call name"
                required
                {...form.getInputProps("name")}
              />
              
              {/* Registered Name */}
              <TextInput
                label="AKC Registered Name"
                placeholder="Enter your dog's AKC registered name (optional)"
                {...form.getInputProps("registeredName")}
              />
              
              {/* Active Status */}
              <Switch
                label="Active"
                description="Inactive dogs won't appear in run entry forms"
                color="blue"
                {...form.getInputProps("active", { type: "checkbox" })}
              />
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
                            style={{ flex: 1, maxWidth: "120px" }}
                            size="sm"
                            required
                            comboboxProps={{
                              position: "bottom-end",
                              middlewares: { flip: true, shift: true },
                              offset: 5
                            }}
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
                loading={updateDogMutation.isPending}
                size="lg"
              >
                Update Dog
              </Button>
            </Stack>
          </form>
        </Paper>

        {/* Dangerous Actions */}
        <Paper withBorder shadow="sm" p="md" radius="md" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
          <Stack gap="md">
            <Stack gap="xs">
              <Text fw={500} c="red">Dangerous Actions</Text>
              <Text size="sm" c="dimmed">
                These actions cannot be undone. Please be certain before proceeding.
              </Text>
            </Stack>
            
            <Button
              variant="outline"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleHardDelete}
              loading={hardDeleteMutation.isPending}
              size="sm"
            >
              Delete Dog Permanently
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
};

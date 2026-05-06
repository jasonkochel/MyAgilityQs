import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type {
  BaselineCounts,
  CompetitionClass,
  CompetitionLevel,
  DogClass,
  UpdateDogRequest,
} from "@my-agility-qs/shared";
import {
  IconArchive,
  IconArchiveOff,
  IconArrowLeft,
  IconCheck,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { BaselineForm } from "../components/BaselineForm";
import {
  type BaselineFormValues,
  buildBaselineRequest,
  emptyBaselineValues,
} from "../lib/baselineHelpers";
import { dogsApi } from "../lib/api";
import { COMPETITION_CLASSES, isPremierClass } from "../lib/constants";

interface DogFormData {
  name: string;
  registeredName: string;
  classSelections: Record<string, { enabled: boolean }>;
  baselineEnabled: boolean;
  baseline: BaselineFormValues;
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
        acc[className] = { enabled: false };
        return acc;
      }, {} as Record<string, { enabled: boolean }>),
      baselineEnabled: false,
      baseline: emptyBaselineValues(COMPETITION_CLASSES),
    },
    validate: {
      name: (value) => (value.trim() ? null : "Dog name is required"),
      classSelections: (value) => {
        const enabledClasses = Object.values(value).filter((c) => c.enabled);
        if (enabledClasses.length === 0) {
          return "At least one class must be selected";
        }
        return null;
      },
    },
  }); // Update form when dog data loads
  useEffect(() => {
    if (dog) {
      // Storage is now canonical short form (post class-name migration), so
      // dog.classes[].name === COMPETITION_CLASSES entry.
      const classSelections = COMPETITION_CLASSES.reduce((acc, className) => {
        const dogClass = dog.classes?.find((c) => c.name === className);
        acc[className] = { enabled: !!dogClass };
        return acc;
      }, {} as Record<string, { enabled: boolean }>);

      // Hydrate baseline form values. Baseline is stored canonically with
      // CompetitionClass enum keys (short form), matching COMPETITION_CLASSES.
      const baselinePerClass = COMPETITION_CLASSES.reduce((acc, className) => {
        const stored = dog.baseline?.perClass?.[className as CompetitionClass];
        acc[className] = {
          level: stored?.level ?? "",
          qs: stored?.qs ?? "",
          top25: stored?.top25 ?? "",
        };
        return acc;
      }, {} as BaselineFormValues["perClass"]);

      form.setValues({
        name: dog.name,
        registeredName: dog.registeredName || "",
        classSelections,
        baselineEnabled: !!dog.baseline,
        baseline: {
          perClass: baselinePerClass,
          machPoints: dog.baseline?.machPoints ?? "",
          doubleQs: dog.baseline?.doubleQs ?? "",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog]);

  const updateDogMutation = useMutation({
    mutationFn: ({ dogId, data }: { dogId: string; data: UpdateDogRequest }) =>
      dogsApi.update(dogId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      // Baseline / class changes feed into computed progress; invalidate so
      // /title-progress reflects the new state without a manual refresh.
      queryClient.invalidateQueries({ queryKey: ["progress"] });
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

  const setActiveMutation = useMutation({
    mutationFn: (active: boolean) =>
      active ? dogsApi.reactivate(dogId!) : dogsApi.deactivate(dogId!),
    onSuccess: (_data, active) => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      notifications.show({
        title: "Success",
        message: active ? "Dog reactivated" : "Dog deactivated",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      navigate("/my-dogs");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update dog status");
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: dogsApi.hardDelete,
    onSuccess: (_data, deletedId) => {
      // Optimistically remove from the cache so /my-dogs reflects the
      // deletion immediately, then invalidate for eventual consistency.
      queryClient.setQueryData<{ id: string }[]>(["dogs"], (old) =>
        old ? old.filter((d) => d.id !== deletedId) : old
      );
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["runs"] });
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

    setError(null);
    // Build the classes array. Server seeds the level (from baseline.level
    // if provided, else the class's default starting level), so we only need
    // to send the class name. Existing dogs preserve their stored level via
    // the server's recompute path. We send level as a no-op pass-through so
    // existing behavior is preserved when baseline is unchanged.
    const classes: DogClass[] = Object.entries(values.classSelections)
      .filter(([, selection]) => selection.enabled)
      .map(([className]) => {
        const existingLevel = dog?.classes?.find((c) => c.name === className)?.level;
        return {
          name: className as CompetitionClass,
          level: (existingLevel ?? "Novice") as CompetitionLevel,
        };
      });

    // Build baseline payload. null clears, undefined leaves untouched, object replaces.
    const enabledClassNames = Object.entries(values.classSelections)
      .filter(([, sel]) => sel.enabled)
      .map(([name]) => name);
    let baseline: BaselineCounts | null | undefined;
    if (values.baselineEnabled) {
      baseline = buildBaselineRequest(values.baseline, enabledClassNames) ?? {};
    } else if (dog?.baseline) {
      baseline = null;
    }

    const apiData: UpdateDogRequest = {
      name: values.name.trim(),
      registeredName: values.registeredName.trim() || undefined,
      classes,
      ...(baseline !== undefined ? { baseline } : {}),
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

              {/* Classes */}
              <Stack gap="xs">
                <Text fw={500}>Classes</Text>
                <Text size="sm" c="dimmed">
                  Tap the classes your dog competes in. Current level shown below
                  classes that have one.
                </Text>
                <SimpleGrid cols={2} spacing="xs">
                  {COMPETITION_CLASSES.map((className) => {
                    const enabled = form.values.classSelections[className]?.enabled;
                    const dogClass = dog?.classes?.find((c) => c.name === className);
                    const showLevel =
                      !isPremierClass(className) &&
                      className !== "T2B" &&
                      !!dogClass?.level;
                    return (
                      <Button
                        key={className}
                        variant={enabled ? "filled" : "outline"}
                        color={enabled ? "blue" : "gray"}
                        size="lg"
                        h={60}
                        onClick={() => toggleClass(className, !enabled)}
                      >
                        <Stack gap={2} align="center">
                          <Text fw={600} size="md">
                            {className}
                          </Text>
                          {showLevel && (
                            <Text size="xs" fw={500} c={enabled ? "white" : "dimmed"}>
                              {dogClass!.level}
                            </Text>
                          )}
                        </Stack>
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
              <Stack gap="sm">
                <Stack gap={0}>
                  <Text fw={500}>Starting Counts</Text>
                  <Text size="sm" c="dimmed">
                    Already have prior Qs? Enter your current totals so progress reflects them.
                  </Text>
                </Stack>

                {form.values.baselineEnabled ? (
                  <Stack gap="sm">
                    <BaselineForm
                      enabledClasses={COMPETITION_CLASSES.filter(
                        (cls) => form.values.classSelections[cls]?.enabled
                      )}
                      values={form.values.baseline}
                      onChange={(v) => form.setFieldValue("baseline", v)}
                    />
                    <Button
                      variant="outline"
                      color="gray"
                      onClick={() => form.setFieldValue("baselineEnabled", false)}
                    >
                      Remove starting counts
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="light"
                    onClick={() => form.setFieldValue("baselineEnabled", true)}
                  >
                    Add starting counts
                  </Button>
                )}
              </Stack>

              <Divider mt="md" />

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

        {/* Footer actions */}
        <Group justify="space-between" wrap="wrap">
          <Button
            variant="subtle"
            color="gray"
            leftSection={
              dog.active ? <IconArchive size={16} /> : <IconArchiveOff size={16} />
            }
            onClick={() => setActiveMutation.mutate(!dog.active)}
            loading={setActiveMutation.isPending}
            size="sm"
          >
            {dog.active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleHardDelete}
            loading={hardDeleteMutation.isPending}
            size="sm"
          >
            Delete dog
          </Button>
        </Group>
      </Stack>
    </Container>
  );
};

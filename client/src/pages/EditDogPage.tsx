import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  NumberInput,
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
  BaselineCounts,
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
import { COMPETITION_CLASSES, COMPETITION_LEVELS, isPremierClass } from "../lib/constants";

interface BaselineFormClass {
  level: string; // empty when not applicable (T2B/Premier)
  qs: number | "";
  top25: number | "";
}

interface DogFormData {
  name: string;
  registeredName: string;
  classSelections: Record<string, { enabled: boolean }>;
  active: boolean;
  baselineEnabled: boolean;
  baseline: {
    perClass: Record<string, BaselineFormClass>;
    machPoints: number | "";
    doubleQs: number | "";
  };
}

const emptyBaselineClass = (): BaselineFormClass => ({ level: "", qs: "", top25: "" });

// Classes that have level progression (Novice/Open/Excellent/Masters).
const isLevelGatedClass = (className: string): boolean =>
  className === "Standard" || className === "Jumpers" || className === "FAST";

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
      active: true,
      baselineEnabled: false,
      baseline: {
        perClass: COMPETITION_CLASSES.reduce((acc, className) => {
          acc[className] = emptyBaselineClass();
          return acc;
        }, {} as Record<string, BaselineFormClass>),
        machPoints: "" as number | "",
        doubleQs: "" as number | "",
      },
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
      }, {} as Record<string, BaselineFormClass>);

      form.setValues({
        name: dog.name,
        registeredName: dog.registeredName || "",
        classSelections,
        active: dog.active,
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
    let baseline: BaselineCounts | null | undefined;
    if (values.baselineEnabled) {
      const perClass: NonNullable<BaselineCounts["perClass"]> = {};
      for (const [uiClass, fields] of Object.entries(values.baseline.perClass)) {
        if (!values.classSelections[uiClass]?.enabled) continue;
        const qs = typeof fields.qs === "number" ? fields.qs : 0;
        const top25 = typeof fields.top25 === "number" ? fields.top25 : 0;
        const level = fields.level || undefined;
        if (qs > 0 || top25 > 0 || level) {
          perClass[uiClass as CompetitionClass] = {
            ...(level && isLevelGatedClass(uiClass) ? { level: level as CompetitionLevel } : {}),
            ...(qs > 0 ? { qs } : {}),
            ...(top25 > 0 ? { top25 } : {}),
          };
        }
      }
      const machPoints =
        typeof values.baseline.machPoints === "number" ? values.baseline.machPoints : 0;
      const doubleQs =
        typeof values.baseline.doubleQs === "number" ? values.baseline.doubleQs : 0;
      baseline = {
        ...(Object.keys(perClass).length > 0 ? { perClass } : {}),
        ...(machPoints > 0 ? { machPoints } : {}),
        ...(doubleQs > 0 ? { doubleQs } : {}),
      };
    } else if (dog?.baseline) {
      baseline = null;
    }

    const apiData: UpdateDogRequest = {
      name: values.name.trim(),
      registeredName: values.registeredName.trim() || undefined,
      classes,
      active: values.active,
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
                    const dogClass = dog?.classes?.find((c) => c.name === className);
                    const showLevel =
                      selection.enabled &&
                      !isPremierClass(className) &&
                      className !== "T2B" &&
                      dogClass?.level;
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
                        {showLevel && (
                          <Text size="sm" c="dimmed">
                            Currently {dogClass!.level}
                          </Text>
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
              <Divider my="xs" />

              {/* Starting Counts (Baseline) */}
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={0}>
                    <Text fw={500}>Starting Counts</Text>
                    <Text size="sm" c="dimmed">
                      Already have prior Qs? Enter your current totals so progress reflects them.
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
                  <Stack gap="md" mt="xs">
                    <Stack gap="sm">
                      {COMPETITION_CLASSES.filter(
                        (cls) => form.values.classSelections[cls]?.enabled
                      ).map((className) => {
                        const isPremier = isPremierClass(className);
                        const isCumulativeT2B = className === "T2B";
                        const isLevelGated = isLevelGatedClass(className); // Std/Jmp/FAST
                        const baselineLevel = form.values.baseline.perClass[className]?.level ?? "";
                        return (
                          <Stack key={className} gap={4}>
                            <Text size="sm" fw={500}>{className}</Text>
                            <Group align="flex-end" gap="sm" wrap="wrap">
                              {isLevelGated && (
                                <Select
                                  label="Current level"
                                  data={COMPETITION_LEVELS}
                                  value={baselineLevel}
                                  onChange={(v) =>
                                    form.setFieldValue(
                                      `baseline.perClass.${className}.level`,
                                      v ?? ""
                                    )
                                  }
                                  style={{ width: 130 }}
                                  size="sm"
                                  comboboxProps={{
                                    position: "bottom-start",
                                    middlewares: { flip: true, shift: true },
                                  }}
                                />
                              )}
                              <NumberInput
                                label={
                                  isCumulativeT2B
                                    ? "Total Qs"
                                    : isLevelGated
                                    ? "Qs at this level"
                                    : "Qs"
                                }
                                placeholder="0"
                                min={0}
                                allowDecimal={false}
                                value={form.values.baseline.perClass[className]?.qs ?? ""}
                                onChange={(v) =>
                                  form.setFieldValue(
                                    `baseline.perClass.${className}.qs`,
                                    v === "" ? "" : Number(v)
                                  )
                                }
                                style={{ flex: 1, minWidth: 120 }}
                                size="sm"
                              />
                              {isPremier && (
                                <NumberInput
                                  label="Top-25% placements"
                                  placeholder="0"
                                  min={0}
                                  allowDecimal={false}
                                  value={form.values.baseline.perClass[className]?.top25 ?? ""}
                                  onChange={(v) =>
                                    form.setFieldValue(
                                      `baseline.perClass.${className}.top25`,
                                      v === "" ? "" : Number(v)
                                    )
                                  }
                                  style={{ flex: 1, minWidth: 140 }}
                                  size="sm"
                                />
                              )}
                            </Group>
                          </Stack>
                        );
                      })}
                    </Stack>

                    <Group gap="sm" grow>
                      <NumberInput
                        label="MACH Points"
                        description="Total Std + Jmp Masters MACH points"
                        placeholder="0"
                        min={0}
                        allowDecimal={false}
                        value={form.values.baseline.machPoints}
                        onChange={(v) =>
                          form.setFieldValue(
                            "baseline.machPoints",
                            v === "" ? "" : Number(v)
                          )
                        }
                        size="sm"
                      />
                      <NumberInput
                        label="Double Qs"
                        description="Same-day Masters Std + Jmp pairs"
                        placeholder="0"
                        min={0}
                        allowDecimal={false}
                        value={form.values.baseline.doubleQs}
                        onChange={(v) =>
                          form.setFieldValue(
                            "baseline.doubleQs",
                            v === "" ? "" : Number(v)
                          )
                        }
                        size="sm"
                      />
                    </Group>

                  </Stack>
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

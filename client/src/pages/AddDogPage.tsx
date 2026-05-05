import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
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
import { notifications } from "@mantine/notifications";
import type {
  BaselineCounts,
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
import { COMPETITION_CLASSES, COMPETITION_LEVELS, isPremierClass } from "../lib/constants";

interface BaselineFormClass {
  level: string;
  qs: number | "";
  top25: number | "";
}

interface DogFormData {
  name: string;
  classSelections: Record<string, { enabled: boolean }>;
  baselineEnabled: boolean;
  baseline: {
    perClass: Record<string, BaselineFormClass>;
    machPoints: number | "";
    doubleQs: number | "";
  };
}

const emptyBaselineClass = (): BaselineFormClass => ({ level: "", qs: "", top25: "" });

const isLevelGatedClass = (className: string): boolean =>
  className === "Standard" || className === "Jumpers" || className === "FAST";

export const AddDogPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm<DogFormData>({
    initialValues: {
      name: "",
      classSelections: COMPETITION_CLASSES.reduce((acc, className) => {
        acc[className] = { enabled: false };
        return acc;
      }, {} as Record<string, { enabled: boolean }>),
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
  });

  const createDogMutation = useMutation({
    mutationFn: dogsApi.create,
    onSuccess: (newDog) => {
      // Optimistically prepend the new dog to the cache so it appears
      // immediately on /dogs, then invalidate for eventual consistency
      // (server-derived fields like cached classes[].level may differ
      // slightly from what we sent).
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
    // Server seeds level from baseline (or defaults to Novice). Send a
    // placeholder level — server overrides during creation.
    const classes: DogClass[] = Object.entries(values.classSelections)
      .filter(([, selection]) => selection.enabled)
      .map(([className]) => ({
        name: className as CompetitionClass,
        level: "Novice" as CompetitionLevel,
      }));

    let baseline: BaselineCounts | undefined;
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
    }

    const apiData: CreateDogRequest = {
      name: values.name.trim(),
      classes,
      ...(baseline ? { baseline } : {}),
    };
    createDogMutation.mutate(apiData);
  };

  const toggleClass = (className: string, enabled: boolean) => {
    form.setFieldValue(`classSelections.${className}.enabled`, enabled);
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
              />

              {/* Classes */}
              <Stack gap="xs">
                <Text fw={500}>Classes</Text>
                <Text size="sm" c="dimmed">
                  Toggle on the classes your dog competes in. New dogs start at Novice;
                  enter your current totals below if you're already competing.
                </Text>
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
                  <Stack gap="md" mt="xs">
                    <Stack gap="sm">
                      {COMPETITION_CLASSES.filter(
                        (cls) => form.values.classSelections[cls]?.enabled
                      ).map((className) => {
                        const isPremier = isPremierClass(className);
                        const isCumulativeT2B = className === "T2B";
                        const isLevelGated = isLevelGatedClass(className);
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

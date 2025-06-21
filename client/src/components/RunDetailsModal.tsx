import {
  Autocomplete,
  Button,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Run, UpdateRunRequest } from "@my-agility-qs/shared";
import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { locationsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";

const PLACEMENT_OPTIONS = [
  { label: "1", value: 1, color: "blue" }, // Blue ribbon
  { label: "2", value: 2, color: "red" }, // Red ribbon
  { label: "3", value: 3, color: "yellow" }, // Yellow ribbon
  { label: "4", value: 4, color: "gray.3" }, // White ribbon (light gray for visibility)
  { label: "X", value: undefined, color: "gray.7" }, // No placement (dark gray)
];

interface RunDetailsModalProps {
  run: Run | null;
  dogNameMap: Record<string, string>;
  onClose: () => void;
  onDelete: (run: Run) => void;
}

export const RunDetailsModal: React.FC<RunDetailsModalProps> = ({
  run,
  dogNameMap,
  onClose,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch unique locations from user's runs for autocomplete
  const { data: locationSuggestions = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: locationsApi.getAll,
    staleTime: Infinity, // Always fresh - preloaded on login, invalidated on changes
  });

  const updateRunMutation = useMutation({
    mutationFn: ({ runId, data }: { runId: string; data: UpdateRunRequest }) =>
      runsApi.updateRun(runId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      
      // Invalidate locations cache if a new location was added
      if (
        variables.data.location &&
        variables.data.location.trim() &&
        !locationSuggestions.includes(variables.data.location.trim())
      ) {
        queryClient.invalidateQueries({ queryKey: ["locations"] });
      }
      
      setIsEditing(false);
      onClose();
      notifications.show({
        title: "Success",
        message: "Run updated successfully",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: `Failed to update run: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        color: "red",
      });
    },
  });

  // Form for editing runs
  const editForm = useForm<UpdateRunRequest>({
    initialValues: {
      placement: undefined,
      location: "",
      machPoints: undefined,
      notes: "",
    },
    validate: {
      placement: (value) => {
        if (value !== undefined && value !== null && (value < 1 || value > 999)) {
          return "Placement must be between 1 and 999";
        }
        return null;
      },
      machPoints: (value) => {
        if (value !== undefined && value !== null && value < 0) {
          return "MACH points cannot be negative";
        }
        return null;
      },
    },
  });

  const handleEditRun = () => {
    if (!run) return;
    
    editForm.setValues({
      placement: run.placement || undefined,
      location: run.location || "",
      machPoints: run.machPoints || undefined,
      notes: run.notes || "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!run || !editForm.isValid()) return;

    const updateData: UpdateRunRequest = {};
    
    // Only include fields that have values
    if (editForm.values.placement !== undefined && editForm.values.placement !== null) {
      updateData.placement = editForm.values.placement;
    } else {
      updateData.placement = null; // Explicitly set to null to clear the field
    }
    
    if (editForm.values.location && editForm.values.location.trim()) {
      updateData.location = editForm.values.location.trim();
    } else {
      updateData.location = ""; // Clear the field
    }
    
    if (editForm.values.machPoints !== undefined && editForm.values.machPoints !== null) {
      updateData.machPoints = editForm.values.machPoints;
    } else {
      updateData.machPoints = undefined; // Clear the field
    }
    
    if (editForm.values.notes && editForm.values.notes.trim()) {
      updateData.notes = editForm.values.notes.trim();
    } else {
      updateData.notes = ""; // Clear the field
    }

    updateRunMutation.mutate({ runId: run.id, data: updateData });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    editForm.reset();
  };

  const handleCloseModal = () => {
    setIsEditing(false);
    editForm.reset();
    onClose();
  };

  const handleDeleteRun = () => {
    if (!run) return;
    handleCloseModal();
    onDelete(run);
  };

  // Helper function to get display name for class
  const getClassDisplayName = (className: string): string => {
    // Find the display name key that maps to this full name
    const displayKey = Object.entries(CLASS_DISPLAY_NAMES).find(
      ([, fullValue]) => fullValue === className
    )?.[0];
    return displayKey || className; // Fallback to original if not found
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, "0")}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!run) return null;

  return (
    <Modal
      opened={run !== null}
      onClose={handleCloseModal}
      title={
        <Text fw={500}>
          {isEditing ? "Edit Run" : "Run Details"} - {
            dogNameMap[run.dogId] || "Unknown Dog"
          }
        </Text>
      }
      size="md"
    >
      <Stack gap="md">
        {/* Non-editable fields */}
        <Group justify="space-between">
          <Text fw={500}>Date:</Text>
          <Text>{formatDate(run.date)}</Text>
        </Group>

        <Group justify="space-between">
          <Text fw={500}>Class:</Text>
          <Text>{getClassDisplayName(run.class)}</Text>
        </Group>

        <Group justify="space-between">
          <Text fw={500}>Level:</Text>
          <Text>{run.level}</Text>
        </Group>

        <Group justify="space-between">
          <Text fw={500}>Result:</Text>
          <Text fw={500} c={run.qualified ? "green" : "red"}>
            {run.qualified ? "Qualified" : "Not Qualified"}
          </Text>
        </Group>

        {run.time && (
          <Group justify="space-between">
            <Text fw={500}>Time:</Text>
            <Text>{formatTime(run.time)}</Text>
          </Group>
        )}

        {/* Editable fields */}
        {isEditing ? (
          <>
            <Stack gap="xs">
              <Text fw={500}>Placement:</Text>
              <SimpleGrid cols={5} spacing="xs">
                {PLACEMENT_OPTIONS.map((option) => (
                  <Button
                    key={option.label}
                    variant={editForm.values.placement === option.value ? "filled" : "outline"}
                    color={editForm.values.placement === option.value ? option.color : "gray"}
                    size="md"
                    h={44}
                    onClick={() => editForm.setFieldValue("placement", option.value)}
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

            <Stack gap="xs">
              <Text fw={500}>Location:</Text>
              <Autocomplete
                placeholder="Enter location (optional)"
                data={locationSuggestions}
                value={editForm.values.location}
                onChange={(value) => editForm.setFieldValue("location", value)}
                error={editForm.errors.location}
              />
            </Stack>

            {(run.level === "Masters" && 
              (run.class === "Standard" || run.class === "Jumpers")) && (
              <Stack gap="xs">
                <Text fw={500}>MACH Points:</Text>
                <NumberInput
                  placeholder="Enter MACH points (optional)"
                  value={editForm.values.machPoints}
                  onChange={(value) => editForm.setFieldValue("machPoints", value as number | undefined)}
                  error={editForm.errors.machPoints}
                  min={0}
                  allowNegative={false}
                  clampBehavior="strict"
                />
              </Stack>
            )}

            <Stack gap="xs">
              <Text fw={500}>Notes:</Text>
              <Textarea
                placeholder="Enter notes (optional)"
                value={editForm.values.notes}
                onChange={(event) => editForm.setFieldValue("notes", event.currentTarget.value)}
                error={editForm.errors.notes}
                minRows={3}
                autosize
              />
            </Stack>
          </>
        ) : (
          <>
            {(run.placement || isEditing) && (
              <Group justify="space-between">
                <Text fw={500}>Placement:</Text>
                <Text>{run.placement || "Not placed"}</Text>
              </Group>
            )}

            {(run.location || isEditing) && (
              <Group justify="space-between">
                <Text fw={500}>Location:</Text>
                <Text>{run.location || "Not specified"}</Text>
              </Group>
            )}

            {run.machPoints !== undefined && run.machPoints !== null && (
              <Group justify="space-between">
                <Text fw={500}>MACH Points:</Text>
                <Text>{run.machPoints}</Text>
              </Group>
            )}

            {(run.notes || isEditing) && (
              <Stack gap={4}>
                <Text fw={500}>Notes:</Text>
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {run.notes || "No notes"}
                </Text>
              </Stack>
            )}
          </>
        )}

        {/* Action buttons */}
        {isEditing ? (
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={handleCancelEdit}
              disabled={updateRunMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              loading={updateRunMutation.isPending}
              disabled={!editForm.isValid()}
            >
              Save Changes
            </Button>
          </Group>
        ) : (
          <Group justify="space-between" mt="md">
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={handleDeleteRun}
            >
              Delete Run
            </Button>
            <Button
              variant="light"
              leftSection={<IconEdit size={16} />}
              onClick={handleEditRun}
            >
              Edit
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
};
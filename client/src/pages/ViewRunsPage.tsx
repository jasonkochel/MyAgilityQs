import {
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { Dog, Run } from "@my-agility-qs/shared";
import { IconArrowLeft, IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { dogsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";

type SortField = "date" | "dog" | "class" | "level";
type SortDirection = "asc" | "desc";

export const ViewRunsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Filter and sort state
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [showOnlyQs, setShowOnlyQs] = useState(false); // Changed to false to show all runs by default
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const {
    data: runs = [],
    isLoading: runsLoading,
    error: runsError,
  } = useQuery({
    queryKey: ["runs"],
    queryFn: runsApi.getAllRuns,
  });
  const {
    data: dogs = [],
    isLoading: dogsLoading,
    error: dogsError,
  } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  const hardDeleteRunMutation = useMutation({
    mutationFn: runsApi.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      notifications.show({
        title: "Success",
        message: "Run has been permanently deleted",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: `Failed to delete run: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        color: "red",
      });
    },
  });

  const handleHardDeleteRun = (run: Run) => {
    const dogName = dogNameMap[run.dogId] || "Unknown Dog";
    modals.openConfirmModal({
      title: "Permanently Delete Run",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to permanently delete this run for <strong>{dogName}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            {formatDate(run.date)} • {getClassDisplayName(run.class)} • {run.level}
          </Text>
          <Text size="sm" c="orange">
            <strong>Warning:</strong> This action cannot be undone.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Delete Permanently", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => hardDeleteRunMutation.mutate(run.id),
    });
  };

  const isLoading = runsLoading || dogsLoading;
  const error = runsError || dogsError;

  // Create a map of dog IDs to dog names for quick lookup
  const dogNameMap = dogs.reduce((acc: Record<string, string>, dog: Dog) => {
    acc[dog.id] = dog.name;
    return acc;
  }, {});

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

  // Filter and sort runs
  const filteredAndSortedRuns = useMemo(() => {
    let filtered = runs;

    // Apply dog filter
    if (selectedDogId) {
      filtered = filtered.filter((run) => run.dogId === selectedDogId);
    } // Apply Q filter (only if not tracking Qs only, since in that mode all runs are Qs)
    if (showOnlyQs && !user?.trackQsOnly) {
      filtered = filtered.filter((run) => run.qualified);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "dog":
          comparison = (dogNameMap[a.dogId] || "").localeCompare(dogNameMap[b.dogId] || "");
          break;
        case "class":
          comparison = getClassDisplayName(a.class).localeCompare(getClassDisplayName(b.class));
          break;
        case "level": {
          // Custom sort for levels (Masters > Excellent > Open > Novice)
          const levelOrder = { Masters: 4, Excellent: 3, Open: 2, Novice: 1 };
          comparison =
            (levelOrder[a.level as keyof typeof levelOrder] || 0) -
            (levelOrder[b.level as keyof typeof levelOrder] || 0);
          break;
        }
      }

      return sortDirection === "desc" ? -comparison : comparison;
    });

    return sorted;
  }, [runs, selectedDogId, showOnlyQs, sortField, sortDirection, dogNameMap, user?.trackQsOnly]);

  // Handle column header clicks for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <IconChevronUp size={14} style={{ marginLeft: 4 }} />
    ) : (
      <IconChevronDown size={14} style={{ marginLeft: 4 }} />
    );
  };
  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text>Loading runs...</Text>
        </Stack>
      </Container>
    );
  }
  if (error) {
    return (
      <Container size="xl" py="md">
        <Stack>
          <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => setLocation("/")}
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
              View Runs
            </Title>
            <div></div>
          </Group>
          <Text c="red">
            Error loading runs: {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </Stack>
      </Container>
    );
  }
  return (
    <Container size="xl" py="md">
      <Stack>
        <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setLocation("/")}
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
            View Runs
          </Title>
          <Text c="dimmed" size="sm">
            {filteredAndSortedRuns.length} run{filteredAndSortedRuns.length !== 1 ? "s" : ""}
          </Text>
        </Group>{" "}
        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            {/* Filter by Dog - Button Style */}
            <Stack gap="xs">
              <Text fw={500} size="sm">
                Filter by Dog
              </Text>
              <SimpleGrid
                cols={(() => {
                  const activeDogs = dogs.filter((dog) => dog.active);
                  // If exactly 2 active dogs, show 3 columns (All + 2 dogs)
                  // Otherwise show 2 columns and let them wrap
                  return activeDogs.length === 2 ? 3 : 2;
                })()}
                spacing="xs"
              >
                {/* All Dogs button */}
                <Button
                  variant={selectedDogId === null ? "filled" : "outline"}
                  color={selectedDogId === null ? "blue" : "gray"}
                  size="sm"
                  onClick={() => setSelectedDogId(null)}
                >
                  All Dogs
                </Button>
                {/* Active dogs buttons */}
                {dogs
                  .filter((dog) => dog.active)
                  .map((dog) => (
                    <Button
                      key={dog.id}
                      variant={selectedDogId === dog.id ? "filled" : "outline"}
                      color={selectedDogId === dog.id ? "blue" : "gray"}
                      size="sm"
                      onClick={() => setSelectedDogId(dog.id)}
                    >
                      {dog.name}
                    </Button>
                  ))}
              </SimpleGrid>
            </Stack>{" "}
            {/* Show only Qs toggle */}
            {!user?.trackQsOnly && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <Switch
                  label="Show only Qs"
                  checked={showOnlyQs}
                  onChange={(event) => setShowOnlyQs(event.currentTarget.checked)}
                  color="green"
                />
              </div>
            )}
          </Stack>
        </Paper>
        {filteredAndSortedRuns.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center">
              <Text size="lg" c="dimmed">
                {runs.length === 0 ? "No runs recorded yet" : "No runs match your filters"}
              </Text>
              {runs.length === 0 && (
                <Button onClick={() => setLocation("/add-run")}>Add Your First Run</Button>
              )}
            </Stack>
          </Paper>
        ) : (
          <Paper withBorder shadow="sm" radius="md">
            <Table highlightOnHover striped stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("date")}
                  >
                    <Group gap={4} wrap="nowrap">
                      Date
                      {renderSortIcon("date")}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("dog")}
                  >
                    <Group gap={4} wrap="nowrap">
                      Dog
                      {renderSortIcon("dog")}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("class")}
                  >
                    <Group gap={4} wrap="nowrap">
                      Class
                      {renderSortIcon("class")}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("level")}
                  >
                    <Group gap={4} wrap="nowrap">
                      Level
                      {renderSortIcon("level")}
                    </Group>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredAndSortedRuns.map((run: Run) => (
                  <Table.Tr
                    key={run.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedRun(run)}
                  >
                    <Table.Td>
                      <Text size="sm">{formatDate(run.date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {dogNameMap[run.dogId] || "Unknown Dog"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{getClassDisplayName(run.class)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{run.level}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
        {/* Modal for run details */}
        <Modal
          opened={selectedRun !== null}
          onClose={() => setSelectedRun(null)}
          title={`Run Details - ${
            selectedRun ? dogNameMap[selectedRun.dogId] || "Unknown Dog" : ""
          }`}
          size="md"
        >
          {selectedRun && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500}>Date:</Text>
                <Text>{formatDate(selectedRun.date)}</Text>
              </Group>

              <Group justify="space-between">
                <Text fw={500}>Class:</Text>
                <Text>{getClassDisplayName(selectedRun.class)}</Text>
              </Group>

              <Group justify="space-between">
                <Text fw={500}>Level:</Text>
                <Text>{selectedRun.level}</Text>
              </Group>

              <Group justify="space-between">
                <Text fw={500}>Result:</Text>
                <Badge color={selectedRun.qualified ? "green" : "red"} variant="light" size="sm">
                  {selectedRun.qualified ? "Q" : "NQ"}
                </Badge>
              </Group>

              {selectedRun.time && (
                <Group justify="space-between">
                  <Text fw={500}>Time:</Text>
                  <Text>{formatTime(selectedRun.time)}</Text>
                </Group>
              )}

              {selectedRun.placement && (
                <Group justify="space-between">
                  <Text fw={500}>Placement:</Text>
                  <Text>{selectedRun.placement}</Text>
                </Group>
              )}

              {selectedRun.location && (
                <Group justify="space-between">
                  <Text fw={500}>Location:</Text>
                  <Text>{selectedRun.location}</Text>
                </Group>
              )}

              {selectedRun.notes && (
                <Stack gap={4}>
                  <Text fw={500}>Notes:</Text>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{selectedRun.notes}</Text>
                </Stack>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setSelectedRun(null)}>
                  Close
                </Button>
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => {
                    setSelectedRun(null);
                    handleHardDeleteRun(selectedRun);
                  }}
                >
                  Delete Run
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
};

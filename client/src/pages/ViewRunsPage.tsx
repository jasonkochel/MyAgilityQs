import {
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { CompetitionClass, CompetitionLevel, Dog, Run } from "@my-agility-qs/shared";
// import { computeDogLevel } from "@my-agility-qs/shared";
import { IconArrowLeft, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { RunDetailsModal } from "../components/RunDetailsModal";
import { RunsGraphView } from "../components/RunsGraphView";
import { useAuth } from "../contexts/AuthContext";
import { useURLState } from "../hooks/useURLState";
import { dogsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES, isPremierClass } from "../lib/constants";

type SortField = "date" | "dog" | "class" | "level";
type SortDirection = "asc" | "desc";

export const ViewRunsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // URL state management - single source of truth
  const [filters, setFilters] = useURLState({
    dog: null as string | null,
    class: null as CompetitionClass | null,
    level: "all" as "current" | "all",
    from: null as string | null,
  });

  // Extract individual filter values for easier access
  const { dog: selectedDogId, class: selectedClass, level: selectedLevel, from } = filters;

  // Local state for non-URL state
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [showOnlyQs, setShowOnlyQs] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["progress"] });
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
            {formatDate(run.date)} • {getClassDisplayName(run.class)}{!isPremierClass(run.class) ? ` • ${run.level}` : ""}
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

  const formatDate = (dateString: string): string => {
    return dayjs(dateString).format("M/D/YYYY");
  };

  const getPlacementBadge = (placement: number | null) => {
    if (!placement) return null;

    const colors = {
      1: "blue",
      2: "red",
      3: "yellow",
      4: "gray",
    } as const;

    return (
      <Badge color={colors[placement as keyof typeof colors] || "gray"} variant="filled" size="sm">
        {placement}
      </Badge>
    );
  };

  // Get distinct classes from actual data
  const distinctClasses = useMemo(() => {
    const classSet = new Set(runs.map((run) => run.class));
    return Array.from(classSet).sort();
  }, [runs]);

  // Helper to determine current level for a dog in a class
  const getCurrentLevel = useCallback(
    (dogId: string, className: string): CompetitionLevel | null => {
      const dogRuns = runs.filter((r) => r.dogId === dogId && r.class === className && r.qualified);
      if (dogRuns.length === 0) return "Novice";

      const levelCounts = dogRuns.reduce((acc, run) => {
        acc[run.level] = (acc[run.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Determine current level based on progression rules
      if (levelCounts["Masters"] || (levelCounts["Excellent"] && levelCounts["Excellent"] >= 3)) {
        return "Masters";
      } else if (levelCounts["Excellent"] || (levelCounts["Open"] && levelCounts["Open"] >= 3)) {
        return "Excellent";
      } else if (levelCounts["Open"] || (levelCounts["Novice"] && levelCounts["Novice"] >= 3)) {
        return "Open";
      }
      return "Novice";
    },
    [runs]
  );

  // Runs filtered by dog and class only (for graph view)
  const graphFilteredRuns = useMemo(() => {
    let filtered = runs;
    if (selectedDogId) {
      filtered = filtered.filter((run) => run.dogId === selectedDogId);
    }
    if (selectedClass) {
      filtered = filtered.filter((run) => run.class === selectedClass);
    }
    return filtered;
  }, [runs, selectedDogId, selectedClass]);

  // Filter and sort runs
  const filteredAndSortedRuns = useMemo(() => {
    let filtered = runs;

    // Apply dog filter
    if (selectedDogId) {
      filtered = filtered.filter((run) => run.dogId === selectedDogId);
    }

    // Apply class filter
    if (selectedClass) {
      filtered = filtered.filter((run) => run.class === selectedClass);
    }

    // Apply level filter
    if (selectedLevel === "current") {
      filtered = filtered.filter((run) => {
        const currentLevel = getCurrentLevel(run.dogId, run.class);
        return run.level === currentLevel;
      });
    }

    // Apply Q filter (only if not tracking Qs only, since in that mode all runs are Qs)
    if (showOnlyQs && !user?.trackQsOnly) {
      filtered = filtered.filter((run) => run.qualified);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
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
  }, [
    runs,
    selectedDogId,
    selectedClass,
    selectedLevel,
    showOnlyQs,
    sortField,
    sortDirection,
    dogNameMap,
    user?.trackQsOnly,
    getCurrentLevel,
  ]);

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
              onClick={() => navigate("/")}
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
            onClick={() => navigate(from === "title-progress" ? "/title-progress" : "/")}
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
            {(viewMode === "graph" ? graphFilteredRuns : filteredAndSortedRuns).length} run{(viewMode === "graph" ? graphFilteredRuns : filteredAndSortedRuns).length !== 1 ? "s" : ""}
          </Text>
        </Group>{" "}
        {/* Filters */}
        <Paper withBorder p="sm" radius="md">
          <Stack gap="sm">
            {/* Dog filter */}
            <SimpleGrid
              cols={(() => {
                const activeDogs = dogs.filter((dog) => dog.active);
                return activeDogs.length === 2 ? 3 : 2;
              })()}
              spacing="xs"
            >
              <Button
                variant={selectedDogId === null ? "filled" : "outline"}
                color={selectedDogId === null ? "blue" : "gray"}
                size="xs"
                onClick={() => setFilters({ dog: null })}
              >
                All Dogs
              </Button>
              {dogs
                .filter((dog) => dog.active)
                .map((dog) => (
                  <Button
                    key={dog.id}
                    variant={selectedDogId === dog.id ? "filled" : "outline"}
                    color={selectedDogId === dog.id ? "blue" : "gray"}
                    size="xs"
                    onClick={() => setFilters({ dog: dog.id })}
                  >
                    {dog.name}
                  </Button>
                ))}
            </SimpleGrid>

            {/* Class filter */}
            <SimpleGrid
              cols={(() => {
                return distinctClasses.length === 2 ? 3 : 2;
              })()}
              spacing="xs"
            >
              <Button
                variant={selectedClass === null ? "filled" : "outline"}
                color={selectedClass === null ? "blue" : "gray"}
                size="xs"
                onClick={() => setFilters({ class: null })}
              >
                All Classes
              </Button>
              {distinctClasses.map((className) => (
                <Button
                  key={className}
                  variant={selectedClass === className ? "filled" : "outline"}
                  color={selectedClass === className ? "blue" : "gray"}
                  size="xs"
                  onClick={() => setFilters({ class: className as CompetitionClass })}
                >
                  {getClassDisplayName(className)}
                </Button>
              ))}
            </SimpleGrid>

            {/* View mode + Level filter side by side */}
            <Group grow gap="xs">
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(v) => setViewMode(v as "list" | "graph")}
                data={[
                  { label: "List", value: "list" },
                  { label: "Graph", value: "graph" },
                ]}
              />
              <SegmentedControl
                size="xs"
                value={selectedLevel ?? "all"}
                onChange={(v) => setFilters({ level: v as "current" | "all" })}
                data={[
                  { label: "All Levels", value: "all" },
                  { label: "Current Level", value: "current" },
                ]}
                disabled={viewMode === "graph"}
                style={viewMode === "graph" ? { opacity: 0.4 } : undefined}
              />
            </Group>

            {/* Show only Qs toggle - only in list mode */}
            {viewMode === "list" && !user?.trackQsOnly && (
              <Switch
                label="Show only Qs"
                checked={showOnlyQs}
                onChange={(event) => setShowOnlyQs(event.currentTarget.checked)}
                color="green"
                size="sm"
              />
            )}
          </Stack>
        </Paper>
        {viewMode === "graph" ? (
          <RunsGraphView runs={graphFilteredRuns} />
        ) : filteredAndSortedRuns.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center">
              <Text size="lg" c="dimmed">
                {runs.length === 0 ? "No runs recorded yet" : "No runs match your filters"}
              </Text>
              {runs.length === 0 && (
                <Button onClick={() => navigate("/add-run")}>Add Your First Run</Button>
              )}
            </Stack>
          </Paper>
        ) : (
          <Paper withBorder shadow="sm" radius="md">
            <div style={{ overflowX: "auto" }}>
              <Table highlightOnHover striped stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      style={{ cursor: "pointer", userSelect: "none", minWidth: "80px" }}
                      onClick={() => handleSort("date")}
                    >
                      <Group gap={4} wrap="nowrap">
                        Date
                        {renderSortIcon("date")}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: "pointer", userSelect: "none", minWidth: "80px" }}
                      onClick={() => handleSort("dog")}
                    >
                      <Group gap={4} wrap="nowrap">
                        Dog
                        {renderSortIcon("dog")}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: "pointer", userSelect: "none", minWidth: "70px" }}
                      onClick={() => handleSort("class")}
                    >
                      <Group gap={4} wrap="nowrap">
                        Class
                        {renderSortIcon("class")}
                      </Group>
                    </Table.Th>
                    <Table.Th
                      style={{ cursor: "pointer", userSelect: "none", minWidth: "80px" }}
                      onClick={() => handleSort("level")}
                    >
                      <Group gap={4} wrap="nowrap">
                        Level
                        {renderSortIcon("level")}
                      </Group>
                    </Table.Th>
                    {/* Result column - only show if tracking NQ runs */}
                    {!user?.trackQsOnly && <Table.Th style={{ minWidth: "60px" }}>Result</Table.Th>}
                    <Table.Th style={{ minWidth: "60px" }}>Place</Table.Th>
                    <Table.Th style={{ minWidth: "60px" }}>Points</Table.Th>
                    <Table.Th style={{ minWidth: "100px" }}>Location</Table.Th>
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
                        <Text size="sm">{isPremierClass(run.class) ? "—" : run.level}</Text>
                      </Table.Td>
                      {/* Result column - only show if tracking NQ runs */}
                      {!user?.trackQsOnly && (
                        <Table.Td>
                          <Badge
                            color={run.qualified ? "green" : "red"}
                            variant={run.qualified ? "filled" : "outline"}
                            size="sm"
                          >
                            {run.qualified ? "Q" : "NQ"}
                          </Badge>
                        </Table.Td>
                      )}
                      <Table.Td>{getPlacementBadge(run.placement)}</Table.Td>
                      <Table.Td>
                        <Text size="sm">{run.machPoints ?? "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="sm"
                          c="dimmed"
                          style={{
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={run.location || ""}
                        >
                          {run.location || "—"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        )}
        <RunDetailsModal
          run={selectedRun}
          dogNameMap={dogNameMap}
          onClose={() => setSelectedRun(null)}
          onDelete={handleHardDeleteRun}
        />
      </Stack>
    </Container>
  );
};

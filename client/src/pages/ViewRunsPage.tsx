import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Popover,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconSearch,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { dogsApi, runsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";
import type { Dog, Run } from "../types";

type SortField = "date" | "dog" | "class" | "level";
type SortDirection = "asc" | "desc";

export const ViewRunsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  // Filter and sort state
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [showOnlyQs, setShowOnlyQs] = useState(true);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
    }

    // Apply Q filter
    if (showOnlyQs) {
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
  }, [runs, selectedDogId, showOnlyQs, sortField, sortDirection, dogNameMap]);

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

  // Dog options for filter
  const dogOptions = dogs.map((dog) => ({
    value: dog.id,
    label: dog.name,
  }));

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
        </Group>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group grow wrap="wrap">
              <Select
                label="Filter by Dog"
                placeholder="All dogs"
                data={dogOptions}
                value={selectedDogId}
                onChange={setSelectedDogId}
                clearable
                searchable
                leftSection={<IconSearch size={16} />}
              />
              <div style={{ display: "flex", alignItems: "end", paddingBottom: "2px" }}>
                <Switch
                  label="Show only Qs"
                  checked={showOnlyQs}
                  onChange={(event) => setShowOnlyQs(event.currentTarget.checked)}
                  color="green"
                />
              </div>
            </Group>
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
            <Table.ScrollContainer minWidth={400}>
              <Table highlightOnHover striped>
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
                    <Table.Th style={{ textAlign: "center" }}>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredAndSortedRuns.map((run: Run) => (
                    <Table.Tr key={run.id} style={{ cursor: "pointer" }}>
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
                      </Table.Td>{" "}
                      <Table.Td style={{ textAlign: "center" }}>
                        <Popover width={300} position="bottom" withArrow shadow="md">
                          <Popover.Target>
                            <ActionIcon variant="subtle" size="sm">
                              <IconEye size={16} />
                            </ActionIcon>
                          </Popover.Target>
                          <Popover.Dropdown>
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Text size="sm" fw={500}>
                                  Result:
                                </Text>
                                <Badge
                                  color={run.qualified ? "green" : "red"}
                                  variant="light"
                                  size="sm"
                                >
                                  {run.qualified ? "Q" : "NQ"}
                                </Badge>
                              </Group>
                              {run.time && (
                                <Group justify="space-between">
                                  <Text size="sm" fw={500}>
                                    Time:
                                  </Text>
                                  <Text size="sm">{formatTime(run.time)}</Text>
                                </Group>
                              )}
                              {run.placement && (
                                <Group justify="space-between">
                                  <Text size="sm" fw={500}>
                                    Placement:
                                  </Text>
                                  <Text size="sm">{run.placement}</Text>
                                </Group>
                              )}
                              {run.notes && (
                                <Stack gap={4}>
                                  <Text size="sm" fw={500}>
                                    Notes:
                                  </Text>
                                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                                    {run.notes}
                                  </Text>
                                </Stack>
                              )}
                            </Stack>
                          </Popover.Dropdown>
                        </Popover>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
    </Container>
  );
};

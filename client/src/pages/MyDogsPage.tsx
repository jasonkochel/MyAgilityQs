import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconDog, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { dogsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";
import type { Dog } from "../types";

export const MyDogsPage: React.FC = () => {
  const [, setLocation] = useLocation();

  // Create reverse mapping from full names to display names
  const getDisplayName = (fullName: string): string => {
    // Find the display name key that maps to this full name
    const displayKey = Object.entries(CLASS_DISPLAY_NAMES).find(
      ([, fullValue]) => fullValue === fullName
    )?.[0];
    return displayKey || fullName; // Fallback to original if not found
  };

  const {
    data: dogs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  if (isLoading) {
    return (
      <Container size="md" py="md">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text>Loading your dogs...</Text>
        </Stack>
      </Container>
    );
  }
  if (error) {
    return (
      <Container size="md" py="md">
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
              My Dogs
            </Title>
            <div></div>
          </Group>
          <Text c="red">
            Error loading dogs: {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </Stack>
      </Container>
    );
  }
  return (
    <Container size="md" py="md">
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
            My Dogs
          </Title>
          <Button
            leftSection={<IconPlus size={16} />}
            variant="light"
            size="sm"
            onClick={() => setLocation("/dogs/add")}
          >
            Add Dog
          </Button>
        </Group>

        {dogs.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center">
              <IconDog size={48} color="var(--mantine-color-gray-5)" />
              <Text size="lg" c="dimmed">
                No dogs registered yet
              </Text>
              <Text size="sm" c="dimmed">
                Add your first dog to start tracking runs
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setLocation("/dogs/add")}>
                Add Your First Dog
              </Button>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {(dogs as Dog[])
              .sort((a, b) => {
                // Sort by active status first (active dogs first)
                if (a.active !== b.active) {
                  return b.active ? 1 : -1;
                }
                // Then sort by name within each group
                return a.name.localeCompare(b.name);
              })
              .map((dog) => (
                <Card
                  key={dog.id}
                  withBorder
                  shadow="sm"
                  radius="md"
                  padding="lg"
                  style={{ cursor: "pointer" }}
                  onClick={() => setLocation(`/dogs/${dog.id}/edit`)}
                >
                  <Group justify="space-between" mb="md">
                    <Group>
                      <IconDog size={24} color="var(--mantine-color-blue-6)" />
                      <Title order={3}>{dog.name}</Title>
                    </Group>
                    <Badge color={dog.active ? "green" : "gray"} variant="light">
                      {dog.active ? "Active" : "Inactive"}
                    </Badge>
                  </Group>

                  <Stack gap="xs">
                    <Text size="sm" c="dimmed" fw={500}>
                      Classes:
                    </Text>
                    {dog.classes && dog.classes.length > 0 ? (
                      <Stack gap="xs">
                        {dog.classes.map((dogClass, index) => (
                          <Group key={index} gap="md" align="center">
                            <Text size="sm" fw={500} style={{ minWidth: "100px" }}>
                              {getDisplayName(dogClass.name)}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {dogClass.level}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No classes assigned
                      </Text>
                    )}
                  </Stack>
                </Card>
              ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
};

import {
  ActionIcon,
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
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { Dog } from "@my-agility-qs/shared";
import { IconArrowLeft, IconDog, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { dogsApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES } from "../lib/constants";

export const MyDogsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const hardDeleteMutation = useMutation({
    mutationFn: dogsApi.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dogs"] });
      notifications.show({
        title: "Success",
        message: "Dog has been permanently deleted",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: `Failed to delete dog: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        color: "red",
      });
    },
  });

  const handleHardDelete = (dog: Dog) => {
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
      onConfirm: () => hardDeleteMutation.mutate(dog.id),
    });
  };

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
                <Card key={dog.id} withBorder shadow="sm" radius="md" padding="lg">
                  <Group justify="space-between" mb="md">
                    <Group>
                      <IconDog size={24} color="var(--mantine-color-blue-6)" />
                      <Title order={3}>{dog.name}</Title>
                    </Group>
                    <Group>
                      <Badge color={dog.active ? "green" : "gray"} variant="light">
                        {dog.active ? "Active" : "Inactive"}
                      </Badge>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHardDelete(dog);
                        }}
                        title="Delete permanently"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>{" "}
                  <Stack
                    gap="xs"
                    onClick={() => setLocation(`/dogs/${dog.id}/edit`)}
                    style={{ cursor: "pointer" }}
                  >
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

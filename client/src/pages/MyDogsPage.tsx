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
import type { Dog, DogProgress } from "@my-agility-qs/shared";
import { IconArrowLeft, IconDog, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { PhotoUpload } from "../components/PhotoUpload";
import { dogsApi, progressApi } from "../lib/api";
import { CLASS_DISPLAY_NAMES, isPremierClass, sortDogClasses } from "../lib/constants";
import { getEarnedTitleSuffixes } from "../utils/titleUtils";

export const MyDogsPage: React.FC = () => {
  const [, navigate] = useLocation();

  // Create reverse mapping from full names to display names
  const getDisplayName = (fullName: string): string => {
    // Find the display name key that maps to this full name
    const displayKey = Object.entries(CLASS_DISPLAY_NAMES).find(
      ([, fullValue]) => fullValue === fullName
    )?.[0];
    return displayKey || fullName; // Fallback to original if not found
  };

  // Format full registered name with earned titles
  const getFullNameWithTitles = (dog: Dog, dogProgress: DogProgress | undefined): string | null => {
    if (!dog.registeredName) return null;
    const titles = getEarnedTitleSuffixes(dog, dogProgress);
    return titles.length > 0
      ? `${dog.registeredName} ${titles.join(' ')}`
      : dog.registeredName;
  };

  const {
    data: dogs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  const { data: progressData = [] } = useQuery({
    queryKey: ["progress"],
    queryFn: progressApi.getAllProgress,
  });

  const progressByDogId = useMemo(() => {
    const map = new Map<string, DogProgress>();
    for (const dp of progressData) {
      map.set(dp.dogId, dp);
    }
    return map;
  }, [progressData]);


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
              onClick={() => navigate('/')}
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
            onClick={() => navigate('/')}
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
            onClick={() => navigate("/dogs/add")}
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
              <Button leftSection={<IconPlus size={16} />} onClick={() => navigate("/dogs/add")}>
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
                <Card key={dog.id} withBorder shadow="sm" radius="md" p="xs">
                  <Group gap="md" align="stretch" wrap="nowrap">
                    {/* Left side - Photo and button stack, vertically centered */}
                    <Stack
                      gap="xs"
                      align="center"
                      justify="center"
                      style={{ width: 'clamp(100px, 25vw, 140px)', flexShrink: 0 }}
                    >
                      {/* Photo area - flexible height based on aspect ratio */}
                      <div
                        style={{
                          width: 'clamp(100px, 25vw, 140px)',
                          position: 'relative',
                          backgroundColor: dog.photoUrl ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-gray-1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--mantine-radius-md)',
                          overflow: 'hidden',
                          minHeight: dog.photoUrl ? 'auto' : 'clamp(100px, 25vw, 140px)', // Only min height for placeholder
                        }}
                      >
                        {dog.photoUrl ? (
                          <img
                            src={dog.photoUrl}
                            alt={`${dog.name} photo`}
                            style={{
                              width: 'clamp(100px, 25vw, 140px)',
                              height: 'auto',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <IconDog size={48} color="var(--mantine-color-gray-5)" />
                        )}
                      </div>

                      {/* Photo button - always same distance from photo container */}
                      <PhotoUpload dog={dog} />
                    </Stack>

                    {/* Right side - Dog information (clickable to edit) */}
                    <Stack
                      gap="xs"
                      style={{
                        flex: 1,
                        cursor: 'pointer',
                        borderRadius: 'var(--mantine-radius-md)'
                      }}
                      onClick={() => navigate(`/dogs/${dog.id}/edit`)}
                    >
                      {/* Header with name and inactive status if applicable */}
                      <Stack gap={0}>
                        <Group gap="sm" align="center">
                          <Title order={3} size="h3">{dog.name}</Title>
                          {!dog.active && (
                            <Badge color="gray" variant="light" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </Group>

                        {/* Registered name with titles */}
                        {getFullNameWithTitles(dog, progressByDogId.get(dog.id)) && (
                          <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                            {getFullNameWithTitles(dog, progressByDogId.get(dog.id))}
                          </Text>
                        )}
                      </Stack>

                      {/* Classes section */}
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed" fw={500}>
                          Classes:
                        </Text>
                        {dog.classes && dog.classes.length > 0 ? (
                          <Stack gap="sm">
                            {sortDogClasses(dog.classes).map((dogClass, index) => (
                              <Group key={index} gap="md" align="baseline" wrap="wrap">
                                <Text size="sm" fw={500} style={{ minWidth: "70px" }}>
                                  {getDisplayName(dogClass.name)}
                                </Text>
                                {!isPremierClass(dogClass.name) && dogClass.name !== "T2B" && (
                                  <Text size="sm" c="dimmed">
                                    {dogClass.level}
                                  </Text>
                                )}
                              </Group>
                            ))}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">
                            No classes assigned
                          </Text>
                        )}
                      </Stack>
                    </Stack>
                  </Group>
                </Card>
              ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
};

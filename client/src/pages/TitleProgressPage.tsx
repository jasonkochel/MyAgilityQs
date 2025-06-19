import {
  Alert,
  Button,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconTrophy, IconTarget } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { DogProgress, Dog, CompetitionLevel } from "@my-agility-qs/shared";
import { useLocation } from "wouter";
import { progressApi, dogsApi } from "../lib/api";

const LEVEL_ORDER: CompetitionLevel[] = ["Novice", "Open", "Excellent", "Masters"];

const getNextLevel = (currentLevel: CompetitionLevel): CompetitionLevel | null => {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevel);
  return currentIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIndex + 1] : null;
};

const getProgressTowardsNextLevel = (classProgress: any, currentLevel: CompetitionLevel): { current: number; needed: number } => {
  // Handle case where no progress data exists for this class yet
  if (!classProgress || !classProgress.levels) {
    return { current: 0, needed: 3 };
  }
  
  const qsAtCurrentLevel = classProgress.levels[currentLevel] || 0;
  
  // Need 3 Qs to advance to next level
  if (qsAtCurrentLevel >= 3) {
    return { current: 3, needed: 3 }; // Already qualified for next level
  }
  
  return { current: qsAtCurrentLevel, needed: 3 };
};

const ClassProgressDisplay: React.FC<{
  className: string;
  currentLevel: CompetitionLevel;
  classProgress: any;
}> = ({ className, currentLevel, classProgress }) => {
  const nextLevel = getNextLevel(currentLevel);
  const progress = getProgressTowardsNextLevel(classProgress, currentLevel);
  const progressPercentage = (progress.current / progress.needed) * 100;
  
  return (
    <div style={{ backgroundColor: 'var(--mantine-color-gray-0)', padding: '12px', borderRadius: '8px' }}>
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text fw={600} size="md">{className}</Text>
          <Text 
            size="sm"
            fw={600}
            c={currentLevel === "Masters" ? "green" : "blue"}
          >
            {currentLevel}
          </Text>
        </Group>
        
        {nextLevel && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {progress.current}/{progress.needed}
              </Text>
            </Group>
            <Progress 
              value={progressPercentage} 
              size="sm" 
              color={progressPercentage >= 100 ? "green" : "blue"}
            />
          </div>
        )}
      </Stack>
    </div>
  );
};

const DogProgressCard: React.FC<{ 
  dog: Dog; 
  dogProgress: DogProgress;
}> = ({ dog, dogProgress }) => {
  // Check if dog is Masters in both Standard and Jumpers for MACH eligibility
  const standardClass = dog.classes.find(c => c.name === "Standard");
  const jumpersClass = dog.classes.find(c => c.name === "Jumpers");
  const isMachEligible = standardClass?.level === "Masters" && jumpersClass?.level === "Masters";
  
  // MACH progress (750 points + 20 Double Qs)
  const machPointsProgress = Math.min((dogProgress.machProgress / 750) * 100, 100);
  const machDoubleQProgress = Math.min((dogProgress.doubleQs / 20) * 100, 100);
  const hasMach = dogProgress.machProgress >= 750 && dogProgress.doubleQs >= 20;
  
  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={3}>{dog.name}</Title>
          {hasMach && (
            <Group gap={4}>
              <IconTrophy size={16} color="var(--mantine-color-green-6)" />
              <Text size="sm" fw={600} c="green">
                MACH
              </Text>
            </Group>
          )}
        </Group>
        
        {/* Class Level Progress */}
        <Grid gutter={8}>
          {dog.classes.map((dogClass) => {
            const classProgress = dogProgress.classProgress.find(cp => cp.class === dogClass.name);
            return (
              <Grid.Col key={dogClass.name} span={{ base: 12, sm: 6, md: 4 }}>
                <ClassProgressDisplay
                  className={dogClass.name}
                  currentLevel={dogClass.level}
                  classProgress={classProgress}
                />
              </Grid.Col>
            );
          })}
        </Grid>
        
        {/* MACH Progress - Only for Masters Standard + Jumpers dogs */}
        {isMachEligible && (
          <div>
            <Text fw={600} size="md" mb={4}>
              MACH Progress
            </Text>
            <Grid gutter={8}>
              <Grid.Col span={6}>
                <div style={{ backgroundColor: 'var(--mantine-color-gray-0)', padding: '12px', borderRadius: '8px' }}>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>Points</Text>
                      <Text size="sm" fw={500}>{dogProgress.machProgress}/750</Text>
                    </Group>
                    <Progress value={machPointsProgress} size="sm" color="purple" />
                  </Stack>
                </div>
              </Grid.Col>
              <Grid.Col span={6}>
                <div style={{ backgroundColor: 'var(--mantine-color-gray-0)', padding: '12px', borderRadius: '8px' }}>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>Double Qs</Text>
                      <Text size="sm" fw={500}>{dogProgress.doubleQs}/20</Text>
                    </Group>
                    <Progress value={machDoubleQProgress} size="sm" color="orange" />
                  </Stack>
                </div>
              </Grid.Col>
            </Grid>
          </div>
        )}
      </Stack>
    </Paper>
  );
};

export const TitleProgressPage: React.FC = () => {
  const [, setLocation] = useLocation();

  // Fetch dogs and progress data
  const { data: dogs, isLoading: dogsLoading, error: dogsError } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  const { data: dogsProgress, isLoading: progressLoading, error: progressError } = useQuery({
    queryKey: ["progress"],
    queryFn: progressApi.getAllProgress,
  });

  const isLoading = dogsLoading || progressLoading;
  const hasError = dogsError || progressError;
  
  const activeDogs = dogs?.filter(dog => dog.active) || [];

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading progress data...</Text>
        </Stack>
      </Container>
    );
  }

  if (hasError) {
    return (
      <Container size="xl" py="md">
        <Stack>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setLocation("/")}
            w="fit-content"
          >
            Back
          </Button>
          <Alert color="red" title="Error loading progress">
            {(dogsError as Error)?.message || (progressError as Error)?.message || "Failed to load progress data"}
          </Alert>
        </Stack>
      </Container>
    );
  }

  const typedDogsProgress = dogsProgress as DogProgress[];

  return (
    <Container size="xl" py="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" w="100%" style={{ position: "relative" }}>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setLocation("/")}
            w="fit-content"
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
            Title Progress
          </Title>
        </Group>

        {/* Dog Progress */}
        {activeDogs.length > 0 && typedDogsProgress ? (
          <Stack gap="sm">
            {activeDogs.map((dog) => {
              const dogProgress = typedDogsProgress.find(dp => dp.dogId === dog.id);
              if (!dogProgress) return null;
              
              return (
                <DogProgressCard 
                  key={dog.id} 
                  dog={dog} 
                  dogProgress={dogProgress} 
                />
              );
            })}
          </Stack>
        ) : (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center" gap="md">
              <IconTarget size={48} color="var(--mantine-color-dimmed)" />
              <Text size="lg" c="dimmed" ta="center">
                No dogs or progress data available
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Add dogs and runs to start tracking title progress!
              </Text>
              <Group>
                <Button onClick={() => setLocation("/my-dogs")}>
                  Manage Dogs
                </Button>
                <Button onClick={() => setLocation("/add-run")}>
                  Add Run
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
};

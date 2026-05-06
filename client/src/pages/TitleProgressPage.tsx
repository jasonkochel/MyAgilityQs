import {
  Alert,
  Badge,
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
import type {
  ClassProgress,
  CompetitionClass,
  CompetitionLevel,
  Dog,
  DogProgress,
  MastersTitle,
  PremierProgress,
} from "@my-agility-qs/shared";
import { IconArrowLeft, IconTarget } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { dogsApi, progressApi } from "../lib/api";
import { isPremierClass, sortDogClasses } from "../lib/constants";
import { getEarnedTitleSuffixes } from "../utils/titleUtils";
import { createViewRunsLink } from "../utils/viewRunsLinks";

const LEVEL_ORDER: CompetitionLevel[] = ["Novice", "Open", "Excellent", "Masters"];

const getNextLevel = (currentLevel: CompetitionLevel): CompetitionLevel | null => {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevel);
  return currentIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIndex + 1] : null;
};

const getProgressTowardsNextLevel = (
  classProgress: ClassProgress | undefined,
  currentLevel: CompetitionLevel,
): { current: number; needed: number } => {
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
  classProgress: ClassProgress | undefined;
  dogProgress: DogProgress;
  dogId: string;
}> = ({ className, currentLevel, classProgress, dogProgress, dogId }) => {
  const [, setLocation] = useLocation();
  const nextLevel = getNextLevel(currentLevel);
  const progress = getProgressTowardsNextLevel(classProgress, currentLevel);
  const progressPercentage = (progress.current / progress.needed) * 100;

  // For Masters level, show title progress instead of level progression
  const isMasters = currentLevel === "Masters";
  let mastersProgress = null;

  if (isMasters) {
    let titleData;
    if (className === "Standard") {
      titleData = dogProgress.mastersTitles?.standardTitles;
    } else if (className === "Jumpers") {
      titleData = dogProgress.mastersTitles?.jumpersTitles;
    } else if (className === "FAST") {
      titleData = dogProgress.fastTitles;
    }

    if (titleData) {
      const earnedTitles = titleData.filter((t) => t.earned);
      const nextTitle = titleData.find((t) => !t.earned);

      mastersProgress = {
        earnedTitles,
        nextTitle,
      };
    }
  }

  const handleClick = () => {
    // Navigate to ViewRunsPage filtered by this dog, class, and current level
    const link = createViewRunsLink({
      dog: dogId,
      class: className as CompetitionClass,
      level: "current",
      from: "title-progress",
    });
    setLocation(link);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--mantine-color-gray-0)",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text fw={600} size="md">
            {className}
          </Text>
          <Text size="sm" fw={600} c={currentLevel === "Masters" ? "green" : "blue"}>
            {currentLevel}
          </Text>
        </Group>

        {/* Show progress - either toward next level or next Masters title */}
        {(nextLevel || mastersProgress?.nextTitle) && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {mastersProgress?.nextTitle
                  ? `${mastersProgress.nextTitle.progress}/${mastersProgress.nextTitle.needed} Qs for ${mastersProgress.nextTitle.title}`
                  : `${progress.current}/${progress.needed} Qs for ${nextLevel}`}
              </Text>
            </Group>
            <Progress
              value={
                mastersProgress?.nextTitle
                  ? (mastersProgress.nextTitle.progress / mastersProgress.nextTitle.needed) * 100
                  : progressPercentage
              }
              size="sm"
              color={progressPercentage >= 100 ? "green" : "blue"}
            />
          </div>
        )}
      </Stack>
    </div>
  );
};

const PremierProgressDisplay: React.FC<{
  premier: PremierProgress;
  dogId: string;
}> = ({ premier, dogId }) => {
  const [, setLocation] = useLocation();
  const nextTier = premier.nextTier;
  const earnedTiers = premier.tiers.filter((t) => t.earned);

  const handleClick = () => {
    const link = createViewRunsLink({
      dog: dogId,
      class: premier.class as CompetitionClass,
      level: "all",
      from: "title-progress",
    });
    setLocation(link);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--mantine-color-gray-0)",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text fw={600} size="md">
            {premier.class === "Premier Std" ? "Premier Standard" : "Premier Jumpers"}
          </Text>
          {earnedTiers.length > 0 && (
            <Group gap={4}>
              {earnedTiers.map((t) => (
                <Badge key={t.title} color="violet" variant="filled" size="sm">
                  {t.title}
                </Badge>
              ))}
            </Group>
          )}
        </Group>

        {/* Show progress toward next tier */}
        {nextTier && (
          <>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {nextTier.qsProgress}/{nextTier.qsNeeded} Qs for {nextTier.title}
                </Text>
              </Group>
              <Progress
                value={(nextTier.qsProgress / nextTier.qsNeeded) * 100}
                size="sm"
                color={nextTier.qsProgress >= nextTier.qsNeeded ? "green" : "blue"}
              />
            </div>

            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {nextTier.top25Progress}/{nextTier.top25Needed} Top 25% Placements
                </Text>
              </Group>
              <Progress
                value={(nextTier.top25Progress / nextTier.top25Needed) * 100}
                size="sm"
                color={nextTier.top25Progress >= nextTier.top25Needed ? "green" : "violet"}
              />
            </div>
          </>
        )}
      </Stack>
    </div>
  );
};

/**
 * T2B is cumulative across all levels (every 15 Qs earns the next title:
 * T2B, T2B2, T2B3, …). It has no level progression, so we render it
 * separately from the level-based ClassProgressDisplay.
 */
const T2BProgressDisplay: React.FC<{
  t2bTitles: MastersTitle[];
  dogId: string;
}> = ({ t2bTitles, dogId }) => {
  const [, setLocation] = useLocation();
  const earnedTitles = t2bTitles.filter((t) => t.earned);
  const nextTitle = t2bTitles.find((t) => !t.earned);

  const handleClick = () => {
    const link = createViewRunsLink({
      dog: dogId,
      class: "T2B" as CompetitionClass,
      level: "all",
      from: "title-progress",
    });
    setLocation(link);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--mantine-color-gray-0)",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text fw={600} size="md">T2B</Text>
          {earnedTitles.length > 0 && (
            <Group gap={4}>
              {earnedTitles.map((t) => (
                <Badge key={t.title} color="pink" variant="filled" size="sm">
                  {t.title}
                </Badge>
              ))}
            </Group>
          )}
        </Group>
        {nextTitle && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {nextTitle.progress}/{nextTitle.needed} Qs for {nextTitle.title}
              </Text>
            </Group>
            <Progress
              value={(nextTitle.progress / nextTitle.needed) * 100}
              size="sm"
              color={nextTitle.progress >= nextTitle.needed ? "green" : "blue"}
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
  const standardClass = dog.classes.find((c) => c.name === "Standard");
  const jumpersClass = dog.classes.find((c) => c.name === "Jumpers");
  const isMachEligible = standardClass?.level === "Masters" && jumpersClass?.level === "Masters";

  // Calculate how many complete MACHs this dog has earned
  const completeMachs = dogProgress.completeMachs || 0;

  // AKC convention: MACH prefix on the registered name. First MACH is just
  // "MACH"; subsequent earnings get a number suffix (MACH2, MACH3, ...).
  const machPrefix =
    completeMachs === 0
      ? ""
      : completeMachs === 1
        ? "MACH "
        : `MACH${completeMachs} `;

  // Calculate progress toward next MACH
  const pointsTowardNext = dogProgress.machProgress - completeMachs * 750;
  const doubleQsTowardNext = dogProgress.doubleQs - completeMachs * 20;

  // Progress bars for next MACH
  const machPointsProgress = Math.min((pointsTowardNext / 750) * 100, 100);
  const machDoubleQProgress = Math.min((doubleQsTowardNext / 20) * 100, 100);

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Title order={3}>
          {machPrefix}
          {dog.name}
          {(() => {
            const titles = getEarnedTitleSuffixes(dog, dogProgress);
            return titles.length > 0 ? ` ${titles.join(" ")}` : "";
          })()}
        </Title>

        {/* Class Level Progress (Premier and T2B handled separately below) */}
        <Grid gutter={8}>
          {sortDogClasses(dog.classes)
            .filter((dogClass) => !isPremierClass(dogClass.name) && dogClass.name !== "T2B")
            .map((dogClass) => {
              const classProgress = dogProgress.classProgress.find(
                (cp) => cp.class === dogClass.name,
              );
              return (
                <Grid.Col key={dogClass.name} span={{ base: 12, sm: 6 }}>
                  <ClassProgressDisplay
                    className={dogClass.name}
                    currentLevel={dogClass.level}
                    classProgress={classProgress}
                    dogProgress={dogProgress}
                    dogId={dog.id}
                  />
                </Grid.Col>
              );
            })}
        </Grid>

        {/* T2B cumulative title progress (no level concept) */}
        {dog.classes.some((c) => c.name === "T2B") && dogProgress.t2bTitles && (
          <Grid gutter={8}>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <T2BProgressDisplay t2bTitles={dogProgress.t2bTitles} dogId={dog.id} />
            </Grid.Col>
          </Grid>
        )}

        {/* Premier Title Progress (server data, baseline-aware) */}
        {(() => {
          const pp = dogProgress.premierProgress;
          if (!pp || pp.length === 0) return null;
          return (
            <Grid gutter={8}>
              {pp.map((premier) => (
                <Grid.Col key={premier.class} span={{ base: 12, sm: 6 }}>
                  <PremierProgressDisplay premier={premier} dogId={dog.id} />
                </Grid.Col>
              ))}
            </Grid>
          );
        })()}

        {/* MACH Progress - Only for Masters Standard + Jumpers dogs */}
        {isMachEligible && (
          <div>
            <Group justify="space-between" align="center" mb={4}>
              <Text fw={600} size="md">
                MACH Progress
              </Text>
              <Text size="sm" c="dimmed">
                {completeMachs > 0
                  ? `Working toward MACH${completeMachs + 1}`
                  : "Working toward first MACH"}
              </Text>
            </Group>
            <Grid gutter={8}>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <div
                  style={{
                    backgroundColor: "var(--mantine-color-gray-0)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Points
                      </Text>
                      <Text size="sm" fw={500}>
                        {pointsTowardNext}/750
                      </Text>
                    </Group>
                    <Progress value={machPointsProgress} size="sm" color="purple" />
                  </Stack>
                </div>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <div
                  style={{
                    backgroundColor: "var(--mantine-color-gray-0)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        Double Qs
                      </Text>
                      <Text size="sm" fw={500}>
                        {doubleQsTowardNext}/20
                      </Text>
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
  const {
    data: dogs,
    isLoading: dogsLoading,
    error: dogsError,
  } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  const {
    data: dogsProgress,
    isLoading: progressLoading,
    error: progressError,
  } = useQuery({
    queryKey: ["progress"],
    queryFn: progressApi.getAllProgress,
  });

  const isLoading = dogsLoading || progressLoading;
  const hasError = dogsError || progressError;

  // Active dogs only, sorted alphabetically by name (locale-aware, case-insensitive)
  // so the page order is stable across reloads and updates.
  const activeDogs =
    dogs
      ?.filter((dog) => dog.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })) || [];

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
          <Alert color="red" title="Error loading data">
            {(dogsError as Error)?.message ||
              (progressError as Error)?.message ||
              "Failed to load data"}
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
              const dogProgress = typedDogsProgress.find((dp) => dp.dogId === dog.id);
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
                <Button onClick={() => setLocation("/my-dogs")}>Manage Dogs</Button>
                <Button onClick={() => setLocation("/add-run")}>Add Run</Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
};

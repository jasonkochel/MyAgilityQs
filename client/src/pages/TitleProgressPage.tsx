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
  PremierProgress,
  PremierTitleTier,
  Run,
} from "@my-agility-qs/shared";
import { IconArrowLeft, IconTarget, IconTrophy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { dogsApi, progressApi, runsApi } from "../lib/api";
import { isPremierClass } from "../lib/constants";
import { createViewRunsLink } from "../utils/viewRunsLinks";

// Client-side Premier progress calculation (server may not have this yet)
const PREMIER_STD_TIERS = [
  { title: "PAD", level: "Premier", qsNeeded: 25, top25Needed: 5 },
  { title: "PADB", level: "Bronze", qsNeeded: 50, top25Needed: 10 },
  { title: "PADS", level: "Silver", qsNeeded: 75, top25Needed: 15 },
  { title: "PADG", level: "Gold", qsNeeded: 100, top25Needed: 20 },
  { title: "PADC", level: "Century", qsNeeded: 125, top25Needed: 25 },
];
const PREMIER_JWW_TIERS = [
  { title: "PJD", level: "Premier", qsNeeded: 25, top25Needed: 5 },
  { title: "PJDB", level: "Bronze", qsNeeded: 50, top25Needed: 10 },
  { title: "PJDS", level: "Silver", qsNeeded: 75, top25Needed: 15 },
  { title: "PJDG", level: "Gold", qsNeeded: 100, top25Needed: 20 },
  { title: "PJDC", level: "Century", qsNeeded: 125, top25Needed: 25 },
];

// Normalize Premier class name to short form for consistent lookups
function normalizePremierClass(name: string): "Premier Std" | "Premier JWW" {
  if (name === "Premier Std" || name === "Premier Standard") return "Premier Std";
  return "Premier JWW";
}

function calculatePremierProgressClient(runs: Run[], premierClassName: string): PremierProgress {
  const normalized = normalizePremierClass(premierClassName);
  // Filter runs matching either short or display form of the class name
  const classRuns = runs.filter(
    (r) => isPremierClass(r.class) && normalizePremierClass(r.class) === normalized && r.qualified,
  );
  const totalQs = classRuns.length;
  const topTwentyFivePercentQs = classRuns.filter((r) => r.topTwentyFivePercent).length;
  const tierDefs = normalized === "Premier Std" ? PREMIER_STD_TIERS : PREMIER_JWW_TIERS;

  const tiers: PremierTitleTier[] = tierDefs.map((def) => ({
    title: def.title,
    level: def.level,
    earned: totalQs >= def.qsNeeded && topTwentyFivePercentQs >= def.top25Needed,
    qsProgress: Math.min(totalQs, def.qsNeeded),
    qsNeeded: def.qsNeeded,
    top25Progress: Math.min(topTwentyFivePercentQs, def.top25Needed),
    top25Needed: def.top25Needed,
  }));

  return {
    class: normalized,
    totalQs,
    topTwentyFivePercentQs,
    tiers,
    nextTier: tiers.find((t) => !t.earned) || null,
  };
}

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

  if (isMasters && dogProgress.mastersTitles) {
    const titleData =
      className === "Standard"
        ? dogProgress.mastersTitles.standardTitles
        : dogProgress.mastersTitles.jumpersTitles;

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

const DogProgressCard: React.FC<{
  dog: Dog;
  dogProgress: DogProgress;
  premierProgress?: PremierProgress[];
}> = ({ dog, dogProgress, premierProgress }) => {
  // Check if dog is Masters in both Standard and Jumpers for MACH eligibility
  const standardClass = dog.classes.find((c) => c.name === "Standard");
  const jumpersClass = dog.classes.find((c) => c.name === "Jumpers");
  const isMachEligible = standardClass?.level === "Masters" && jumpersClass?.level === "Masters";

  // Calculate how many complete MACHs this dog has earned
  const completeMachs = dogProgress.completeMachs || 0;

  // Calculate progress toward next MACH
  const pointsTowardNext = dogProgress.machProgress - completeMachs * 750;
  const doubleQsTowardNext = dogProgress.doubleQs - completeMachs * 20;

  // Progress bars for next MACH
  const machPointsProgress = Math.min((pointsTowardNext / 750) * 100, 100);
  const machDoubleQProgress = Math.min((doubleQsTowardNext / 20) * 100, 100);

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={3}>{dog.name}</Title>
          {completeMachs > 0 && (
            <Group gap="xs">
              <IconTrophy size={16} color="var(--mantine-color-green-6)" />
              <Group gap={4}>
                {Array.from({ length: completeMachs }, (_, i) => (
                  <Badge key={i} color="green" variant="filled" size="sm">
                    MACH{i + 1}
                  </Badge>
                ))}
              </Group>
            </Group>
          )}
        </Group>

        {/* Class Level Progress (non-Premier) */}
        <Grid gutter={8}>
          {dog.classes
            .filter((dogClass) => !isPremierClass(dogClass.name))
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

        {/* Premier Title Progress - use client-side calculation, fall back to server data */}
        {(() => {
          const pp = premierProgress || dogProgress.premierProgress;
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

  // Fetch runs for client-side Premier progress calculation
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: runsApi.getAllRuns,
  });

  const isLoading = dogsLoading || progressLoading || runsLoading;
  const hasError = dogsError || progressError;

  const activeDogs = dogs?.filter((dog) => dog.active) || [];

  // Calculate Premier progress client-side (supplements server data which may not include it yet)
  const premierProgressByDog = useMemo(() => {
    const map = new Map<string, PremierProgress[]>();
    if (!dogs) return map;
    for (const dog of dogs) {
      const premierClasses = dog.classes.filter((c) => isPremierClass(c.name));
      if (premierClasses.length === 0) continue;
      const dogRuns = runs.filter((r) => r.dogId === dog.id);
      const progress = premierClasses.map((c) => calculatePremierProgressClient(dogRuns, c.name));
      map.set(dog.id, progress);
    }
    return map;
  }, [dogs, runs]);

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
                  premierProgress={premierProgressByDog.get(dog.id)}
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

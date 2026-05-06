import { Anchor, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconDog } from "@tabler/icons-react";
import { useLocation } from "wouter";

export const AboutPage: React.FC = () => {
  const [, navigate] = useLocation();

  return (
    <Container size="sm" py="md">
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/")}
          w="fit-content"
        >
          Back
        </Button>

        <Group gap="md" align="center">
          <IconDog size={32} color="var(--mantine-color-blue-6)" />
          <Title order={1} c="blue.6">
            MyAgilityQs
          </Title>
        </Group>

        <Paper withBorder shadow="sm" p="lg" radius="md">
          <Stack gap="md">
            <Text>
              MyAgilityQs is a quick, mobile-friendly way to track your AKC agility
              competition results — qualifying runs, level progression, double Qs, MACH
              points, and title progress for every class your dog runs.
            </Text>

            <Text>
              Built for handlers who want a fast, no-fuss way to log runs at a trial and
              see exactly where they stand on every title in progress.
            </Text>

            <Stack gap={4}>
              <Title order={5}>What you can track</Title>
              <Text size="sm">
                Standard, Jumpers, FAST, Premier, and Time 2 Beat — across Novice, Open,
                Excellent, and Masters levels, plus Bronze / Silver / Gold / Century
                title tiers and MACH/MACH2/MACH3+ progress.
              </Text>
            </Stack>

            <Stack gap={4}>
              <Title order={5}>Privacy</Title>
              <Text size="sm">
                Your runs and dogs are private to your account. Sign in with email or
                Google.
              </Text>
            </Stack>

            <Stack gap={4}>
              <Title order={5}>Feedback</Title>
              <Text size="sm">
                Found a bug or have a suggestion?{" "}
                <Anchor href="mailto:feedback@myagilityqs.com">
                  feedback@myagilityqs.com
                </Anchor>
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
};

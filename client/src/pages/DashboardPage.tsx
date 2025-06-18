import { Card, Container, Grid, Group, Stack, Text, Title } from "@mantine/core";
import { IconChartBar, IconDog, IconRun, IconTrophy } from "@tabler/icons-react";

export const DashboardPage: React.FC = () => {
  return (
    <Container size="xl">
      <Stack>
        <Title order={1} mb="xl">
          Dashboard
        </Title>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconDog size={32} color="var(--mantine-color-blue-6)" />
                <div>
                  <Text size="xl" fw={700}>
                    0
                  </Text>
                  <Text size="sm" c="dimmed">
                    Active Dogs
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconRun size={32} color="var(--mantine-color-green-6)" />
                <div>
                  <Text size="xl" fw={700}>
                    0
                  </Text>
                  <Text size="sm" c="dimmed">
                    Total Runs
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconTrophy size={32} color="var(--mantine-color-yellow-6)" />
                <div>
                  <Text size="xl" fw={700}>
                    0
                  </Text>
                  <Text size="sm" c="dimmed">
                    Qualifying Runs
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconChartBar size={32} color="var(--mantine-color-purple-6)" />
                <div>
                  <Text size="xl" fw={700}>
                    0%
                  </Text>
                  <Text size="sm" c="dimmed">
                    Success Rate
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid mt="xl">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h={300}>
              <Title order={3} mb="md">
                Recent Runs
              </Title>
              <Text c="dimmed" ta="center" mt="xl">
                No runs yet. Add your first dog and start tracking runs!
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h={300}>
              <Title order={3} mb="md">
                Progress Overview
              </Title>
              <Text c="dimmed" ta="center" mt="xl">
                Progress charts will appear here once you have data.
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};

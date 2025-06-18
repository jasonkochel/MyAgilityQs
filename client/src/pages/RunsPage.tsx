import { Container, Stack, Text, Title } from "@mantine/core";

export const RunsPage: React.FC = () => {
  return (
    <Container size="xl">
      <Stack>
        <Title order={1}>Runs</Title>
        <Text c="dimmed">Track your agility runs here. (Coming soon!)</Text>
      </Stack>
    </Container>
  );
};

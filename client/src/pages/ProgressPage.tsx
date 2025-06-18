import { Container, Stack, Text, Title } from "@mantine/core";

export const ProgressPage: React.FC = () => {
  return (
    <Container size="xl">
      <Stack>
        <Title order={1}>Progress</Title>
        <Text c="dimmed">View your progress analytics here. (Coming soon!)</Text>
      </Stack>
    </Container>
  );
};

import { Container, Stack, Text, Title } from "@mantine/core";

export const DogsPage: React.FC = () => {
  return (
    <Container size="xl">
      <Stack>
        <Title order={1}>Dogs</Title>
        <Text c="dimmed">Manage your agility dogs here. (Coming soon!)</Text>
      </Stack>
    </Container>
  );
};

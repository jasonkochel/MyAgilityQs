import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useLocation } from "wouter";

export const TitleProgressPage: React.FC = () => {
  const [, setLocation] = useLocation();

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

        <Title order={1}>Title Progress</Title>

        <Text c="dimmed">Q count tabulation and QQ tracking will be implemented here.</Text>
      </Stack>
    </Container>
  );
};

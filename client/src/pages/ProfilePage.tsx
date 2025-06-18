import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconLogout } from "@tabler/icons-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";

export const ProfilePage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <Container size="sm" py="md">
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => setLocation("/")}
          w="fit-content"
        >
          Back
        </Button>

        <Title order={1}>Profile</Title>

        <Stack gap="lg">
          <div>
            <Text fw={500}>Email</Text>
            <Text c="dimmed">{user?.email}</Text>
          </div>

          <Group>
            <Button
              variant="outline"
              color="red"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Container>
  );
};

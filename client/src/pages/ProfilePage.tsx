import { Button, Container, Group, Stack, Switch, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconFileImport, IconLogout } from "@tabler/icons-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import PWAInstallButton from "../components/PWAInstallButton";

export const ProfilePage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, logout, updateUserPreferences } = useAuth();
  const { goBack } = useNavigationHistory();

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
          onClick={goBack}
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

          <div>
            <Text fw={500} mb="xs">
              Preferences
            </Text>
            <Switch
              label="Track Qs Only"
              description="When enabled, only qualifying runs will be tracked. Q/NQ options will be hidden."
              checked={user?.trackQsOnly ?? false}
              onChange={async (event) => {
                try {
                  await updateUserPreferences({ trackQsOnly: event.currentTarget.checked });
                  notifications.show({
                    title: "Success",
                    message: "Preference updated successfully",
                    color: "green",
                  });
                } catch {
                  notifications.show({
                    title: "Error",
                    message: "Failed to update preference",
                    color: "red",
                  });
                }
              }}
              color="green"
            />
          </div>

          <div>
            <Text fw={500} mb="xs">
              Import Data
            </Text>
            <Button
              variant="light"
              leftSection={<IconFileImport size={16} />}
              onClick={() => setLocation("/import")}
              fullWidth
            >
              Import Runs from Text
            </Button>
            <Text size="xs" c="dimmed" mt="xs">
              Import historical run data from spreadsheets or other sources
            </Text>
          </div>

          {/* PWA Installation */}
          <div>
            <Text fw={500} mb="xs">
              Install App
            </Text>
            <PWAInstallButton compact showDebugInfo />
            <Text size="xs" c="dimmed" mt="xs">
              Install MyAgilityQs on your device for quick access and offline use
            </Text>
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

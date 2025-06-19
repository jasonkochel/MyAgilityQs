import { Button, Container, Group, Stack, Switch, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconLogout, IconRefresh } from "@tabler/icons-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { tokenManager } from "../lib/api";

export const ProfilePage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, logout, updateUserPreferences } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };
  const handleRefreshToken = async () => {
    try {
      console.log("Current refresh token:", tokenManager.getRefreshToken());
      await tokenManager.refreshAccessToken();
      notifications.show({
        title: "Success",
        message: "Token refreshed successfully",
        color: "green",
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      notifications.show({
        title: "Error",
        message: `Token refresh failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        color: "red",
      });
    }
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
        <Title order={1}>Profile</Title>{" "}
        <Stack gap="lg">
          <div>
            <Text fw={500}>Email</Text>
            <Text c="dimmed">{user?.email}</Text>
          </div>{" "}
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
                } catch (error) {
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
          <Group>
            <Button
              variant="outline"
              color="blue"
              leftSection={<IconRefresh size={16} />}
              onClick={handleRefreshToken}
            >
              Refresh Token (Debug)
            </Button>

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

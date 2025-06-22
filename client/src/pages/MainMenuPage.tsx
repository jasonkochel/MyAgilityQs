import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconDog, IconList, IconLogout, IconPlus, IconTrophy, IconUser } from "@tabler/icons-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import InstallPrompt from "../components/InstallPrompt";

export const MainMenuPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };
  const menuItems = [
    {
      label: "Add Run",
      description: "Record a new agility run",
      icon: IconPlus,
      href: "/add-run",
      color: "blue",
    },
    {
      label: "View Runs",
      description: "Browse and manage your runs",
      icon: IconList,
      href: "/view-runs",
      color: "teal",
    },
    {
      label: "Title Progress",
      description: "Track Qs and title progress",
      icon: IconTrophy,
      href: "/title-progress",
      color: "orange",
    },
    {
      label: "My Dogs",
      description: "Manage your dogs",
      icon: IconDog,
      href: "/my-dogs",
      color: "violet",
    },
    {
      label: "Profile",
      description: "Settings and account",
      icon: IconUser,
      href: "/profile",
      color: "dark",
    },
  ];

  return (
    <Container size="sm" py="md">
      <Stack align="center" gap="md">
        {/* Header */}
        <Group justify="center" align="center" gap="md">
          <IconDog size={32} color="var(--mantine-color-blue-6)" />
          <Title order={1} c="blue.6">
            MyAgilityQs
          </Title>
        </Group>

        <Text c="dimmed" ta="center">
          Welcome back, {user?.email}
        </Text>

        {/* Main Menu Buttons */}
        <Stack w="100%" maw={400} gap="md">
          {" "}
          {menuItems.map((item) => (
            <Button
              key={item.href}
              variant="filled"
              color={item.color}
              size="xl"
              h={64}
              leftSection={<item.icon size={24} />}
              onClick={() => setLocation(item.href)}
              styles={{
                inner: {
                  justifyContent: "flex-start",
                },
                label: {
                  flex: 1,
                  textAlign: "left",
                },
              }}
            >
              {" "}
              <Stack gap={2} align="flex-start">
                <Text fw={600} size="lg" c="white">
                  {item.label}
                </Text>
                <Text size="sm" c="white" opacity={0.9}>
                  {item.description}
                </Text>
              </Stack>
            </Button>
          ))}
        </Stack>

        {/* PWA Installation Prompt */}
        <InstallPrompt />

        {/* Logout Button */}
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconLogout size={16} />}
          onClick={handleLogout}
          mt="md"
        >
          Sign Out
        </Button>
      </Stack>
    </Container>
  );
};

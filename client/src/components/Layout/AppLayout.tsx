import { AppShell, Avatar, Button, Group, NavLink, Text } from "@mantine/core";
import { IconChartBar, IconDashboard, IconDog, IconLogout, IconRun } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import classes from "./AppLayout.module.css";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [opened, setOpened] = useState(false);
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
    { label: "Dogs", href: "/dogs", icon: IconDog },
    { label: "Runs", href: "/runs", icon: IconRun },
    { label: "Progress", href: "/progress", icon: IconChartBar },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Text size="lg" fw={700} c="blue.6">
              MyAgilityQs
            </Text>
          </Group>

          <Group>
            <Avatar size={32} radius="xl" color="blue">
              {user?.email.charAt(0).toUpperCase() || "U"}
            </Avatar>
            <Text size="sm" fw={500}>
              {user?.email}
            </Text>
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              leftSection={<item.icon size="1rem" />}
              active={location === item.href}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.href);
                setOpened(false);
              }}
              className={classes.navLink}
            />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};

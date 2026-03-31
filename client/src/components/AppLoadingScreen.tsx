import { Center, Loader, Stack, Text } from "@mantine/core";
import { IconDog } from "@tabler/icons-react";

export const AppLoadingScreen: React.FC = () => {
  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <IconDog size={48} color="var(--mantine-color-blue-6)" />
        <Text fw={700} size="xl" c="blue.6">
          MyAgilityQs
        </Text>
        <Loader color="blue" size="md" />
      </Stack>
    </Center>
  );
};

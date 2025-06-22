import React, { useEffect, useState } from 'react';
import { Button, Card, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconX } from '@tabler/icons-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ onDismiss, compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setShowPrompt(false);
      setDeferredPrompt(null);
      
      notifications.show({
        title: 'App Installed!',
        message: 'MyAgilityQs has been added to your home screen',
        color: 'green',
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the saved prompt since it can only be used once
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error showing install prompt:', error);
      notifications.show({
        title: 'Installation Error',
        message: 'Could not install the app. Please try again.',
        color: 'red',
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onDismiss?.();
  };

  // Don't show if no prompt is available or if already dismissed
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  if (compact) {
    return (
      <Button
        variant="light"
        color="blue"
        leftSection={<IconDownload size={16} />}
        onClick={handleInstallClick}
        size="sm"
      >
        Install App
      </Button>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Title order={4} size="md" mb="xs">
            Install MyAgilityQs
          </Title>
          <Text size="sm" c="dimmed">
            Add this app to your home screen for quick access and offline use
          </Text>
        </div>
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          onClick={handleDismiss}
          p={4}
        >
          <IconX size={16} />
        </Button>
      </Group>
      
      <Group justify="flex-end" mt="md">
        <Button variant="outline" size="sm" onClick={handleDismiss}>
          Not Now
        </Button>
        <Button
          variant="filled"
          color="blue"
          size="sm"
          leftSection={<IconDownload size={16} />}
          onClick={handleInstallClick}
        >
          Install
        </Button>
      </Group>
    </Card>
  );
};

export default InstallPrompt;
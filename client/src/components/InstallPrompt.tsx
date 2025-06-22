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
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    console.log('[InstallPrompt] Component mounted, waiting for beforeinstallprompt event');
    
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[InstallPrompt] beforeinstallprompt event fired!', e);
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    // Show fallback after a delay if no browser prompt appears
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !showPrompt) {
        console.log('[InstallPrompt] No browser prompt detected, showing fallback');
        setShowFallback(true);
      }
    }, 3000); // Wait 3 seconds for browser prompt

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
      clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt, showPrompt]);

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
    setShowFallback(false);
    onDismiss?.();
  };

  const handleFallbackInstall = () => {
    // Show instructions for manual installation
    notifications.show({
      title: 'Install MyAgilityQs',
      message: 'Tap the browser menu and look for "Add to Home Screen" or "Install App"',
      color: 'blue',
      autoClose: 7000,
    });
  };

  // Don't show if no prompt is available and no fallback
  if (!showPrompt && !showFallback) {
    return null;
  }

  if (compact) {
    return (
      <Button
        variant="light"
        color="blue"
        leftSection={<IconDownload size={16} />}
        onClick={deferredPrompt ? handleInstallClick : handleFallbackInstall}
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
          onClick={deferredPrompt ? handleInstallClick : handleFallbackInstall}
        >
          Install
        </Button>
      </Group>
    </Card>
  );
};

export default InstallPrompt;
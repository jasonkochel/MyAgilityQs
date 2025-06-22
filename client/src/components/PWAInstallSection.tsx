import React, { useEffect, useState } from 'react';
import { Button, Card, Group, Text, Title, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconInfoCircle } from '@tabler/icons-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallSection: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // Check if already installed
    const checkIfInstalled = () => {
      const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isInstalled = isRunningStandalone || isIOSStandalone;
      
      setIsInstalled(isInstalled);
      
      let info = `Standalone: ${isRunningStandalone}, iOS: ${isIOSStandalone}, Installed: ${isInstalled}`;
      info += `\nUser Agent: ${navigator.userAgent.substring(0, 100)}...`;
      info += `\nService Worker Support: ${'serviceWorker' in navigator}`;
      
      setDebugInfo(info);
      
      return isInstalled;
    };

    if (checkIfInstalled()) {
      return; // Don't show install prompt if already installed
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWAInstallSection] beforeinstallprompt event fired!', e);
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      setDebugInfo(prev => prev + '\n✅ Browser install prompt available!');
    };

    const handleAppInstalled = () => {
      console.log('[PWAInstallSection] App was installed');
      setIsInstalled(true);
      setDeferredPrompt(null);
      
      notifications.show({
        title: 'App Installed!',
        message: 'MyAgilityQs has been added to your home screen',
        color: 'green',
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Update debug info after a short delay
    setTimeout(() => {
      if (!deferredPrompt) {
        setDebugInfo(prev => prev + '\n❌ No browser install prompt detected');
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log('Install prompt result:', outcome);
        setDeferredPrompt(null);
        
        if (outcome === 'dismissed') {
          notifications.show({
            title: 'Installation Cancelled',
            message: 'You can install the app later from your browser menu',
            color: 'yellow',
          });
        }
      } catch (error) {
        console.error('Error showing install prompt:', error);
        handleManualInstall();
      }
    } else {
      handleManualInstall();
    }
  };

  const handleManualInstall = () => {
    notifications.show({
      title: 'Install MyAgilityQs',
      message: 'Look for "Add to Home Screen" in your browser menu (⋮) or address bar',
      color: 'blue',
      autoClose: 8000,
    });
  };

  if (isInstalled) {
    return (
      <Alert color="green" icon={<IconInfoCircle size={16} />}>
        MyAgilityQs is already installed on your device!
      </Alert>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Title order={4} size="md" mb="xs">
            Install MyAgilityQs
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            Add this app to your home screen for quick access and offline use
          </Text>
          
          {/* Debug Info - Remove in production */}
          <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
            {debugInfo}
          </Text>
        </div>
      </Group>
      
      <Group justify="flex-end" mt="md">
        <Button
          variant="filled"
          color="blue"
          size="sm"
          leftSection={<IconDownload size={16} />}
          onClick={handleInstallClick}
        >
          {deferredPrompt ? 'Install App' : 'Install Instructions'}
        </Button>
      </Group>
    </Card>
  );
};

export default PWAInstallSection;
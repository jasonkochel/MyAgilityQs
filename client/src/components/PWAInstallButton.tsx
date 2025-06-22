import React from 'react';
import { Button, Alert, Text } from '@mantine/core';
import { IconDownload, IconInfoCircle } from '@tabler/icons-react';
import { usePWA } from '../contexts/PWAContext';

interface PWAInstallButtonProps {
  compact?: boolean;
  showDebugInfo?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  compact = false, 
  showDebugInfo = false 
}) => {
  const { isInstallable, isInstalled, promptInstall, deferredPrompt } = usePWA();

  if (isInstalled) {
    return (
      <Alert color="green" icon={<IconInfoCircle size={16} />}>
        MyAgilityQs is already installed on your device!
      </Alert>
    );
  }

  if (!isInstallable && !showDebugInfo) {
    // Don't show anything if not installable and we're not debugging
    return null;
  }

  const buttonText = deferredPrompt ? 'Install App' : 'Install Instructions';
  
  if (compact) {
    return (
      <div>
        <Button
          variant="light"
          color="blue"
          leftSection={<IconDownload size={16} />}
          onClick={promptInstall}
          size="sm"
        >
          {buttonText}
        </Button>
        {showDebugInfo && (
          <Text size="xs" c="dimmed" mt="xs">
            Installable: {isInstallable ? 'Yes' : 'No'} | 
            Prompt available: {deferredPrompt ? 'Yes' : 'No'}
          </Text>
        )}
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="filled"
        color="blue"
        leftSection={<IconDownload size={16} />}
        onClick={promptInstall}
        fullWidth
      >
        {buttonText}
      </Button>
      {showDebugInfo && (
        <Text size="xs" c="dimmed" mt="xs">
          Debug: Installable={isInstallable ? 'true' : 'false'}, 
          Prompt={deferredPrompt ? 'available' : 'null'}, 
          Installed={isInstalled ? 'true' : 'false'}
        </Text>
      )}
    </div>
  );
};

export default PWAInstallButton;
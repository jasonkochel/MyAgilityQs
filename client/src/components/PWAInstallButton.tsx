import { Button, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import React from 'react';
import { usePWA } from '../contexts/PWAContext';

interface PWAInstallButtonProps {
  compact?: boolean;
  showDebugInfo?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showDebugInfo = false
}) => {
  const { isInstallable, isInstalled, promptInstall, deferredPrompt, platform } = usePWA();

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !showDebugInfo) {
    // Don't show anything if not installable and we're not debugging
    return null;
  }

  // When the browser provided a native prompt, "Install App" is accurate.
  // Otherwise we're going to show manual instructions — phrase the CTA
  // around what the user is about to do, not the technical capability.
  const buttonText = deferredPrompt
    ? "Install App"
    : platform === "ios"
    ? "Add to Home Screen"
    : "How to install";

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
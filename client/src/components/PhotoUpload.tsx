import { Box, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import type { Dog } from '@my-agility-qs/shared';
import { IconCamera, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { dogsApi } from '../lib/api';
import { cropImageFile, formatFileSize, resizeImageFile } from '../utils/imageUtils';

interface PhotoUploadProps {
  dog: Dog;
  onPhotoUpdate?: (photoUrl: string, photoCrop?: Dog['photoCrop']) => void;
}

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

interface InteractiveCropProps {
  previewUrl: string;
  cropData: CropData;
  onCropChange: (crop: CropData) => void;
}

const InteractiveCrop: React.FC<InteractiveCropProps> = ({ previewUrl, cropData, onCropChange }) => {
  const [isDragging, setIsDragging] = useState<HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCrop, setInitialCrop] = useState<CropData>(cropData);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const getMousePosition = useCallback((event: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();

    // Handle touch events
    const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : event.clientX;
    const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : event.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent | React.TouchEvent, handle: HandlePosition) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(handle);
    setDragStart(getMousePosition(event));
    setInitialCrop(cropData);
  }, [cropData, getMousePosition]);

  const handleMouseMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const currentPos = getMousePosition(event);
    const deltaX = currentPos.x - dragStart.x;
    const deltaY = currentPos.y - dragStart.y;

    let newCrop = { ...initialCrop };

    switch (isDragging) {
      case 'move':
        newCrop.x = Math.max(0, Math.min(100 - initialCrop.width, initialCrop.x + deltaX));
        newCrop.y = Math.max(0, Math.min(100 - initialCrop.height, initialCrop.y + deltaY));
        break;

      case 'nw':
        newCrop.x = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + deltaX));
        newCrop.y = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + deltaY));
        newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x);
        newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y);
        break;

      case 'n':
        newCrop.y = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + deltaY));
        newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y);
        break;

      case 'ne':
        newCrop.y = Math.max(0, Math.min(initialCrop.y + initialCrop.height - 10, initialCrop.y + deltaY));
        newCrop.width = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.width + deltaX));
        newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y);
        break;

      case 'e':
        newCrop.width = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.width + deltaX));
        break;

      case 'se':
        newCrop.width = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.width + deltaX));
        newCrop.height = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.height + deltaY));
        break;

      case 's':
        newCrop.height = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.height + deltaY));
        break;

      case 'sw':
        newCrop.x = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + deltaX));
        newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x);
        newCrop.height = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.height + deltaY));
        break;

      case 'w':
        newCrop.x = Math.max(0, Math.min(initialCrop.x + initialCrop.width - 10, initialCrop.x + deltaX));
        newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x);
        break;
    }

    onCropChange(newCrop);
  }, [isDragging, dragStart, initialCrop, getMousePosition, onCropChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleStyle = {
    position: 'absolute' as const,
    width: '16px',
    height: '16px',
    backgroundColor: 'white',
    border: '2px solid #1c7ed6',
    borderRadius: '50%',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    // Add larger touch target for mobile
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-8px',
      left: '-8px',
      right: '-8px',
      bottom: '-8px',
    },
  };

  return (
    <Box
      ref={containerRef}
      pos="relative"
      w="100%"
      h={300}
      style={{
        overflow: 'hidden',
        borderRadius: 'var(--mantine-radius-sm)',
        border: '1px solid var(--mantine-color-gray-3)',
      }}
    >
      {/* Image */}
      <img
        ref={imageRef}
        src={previewUrl}
        alt="Photo preview"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />

      {/* Dark overlay for cropped areas */}
      <Box pos="absolute" top={0} left={0} w="100%" h="100%" style={{ pointerEvents: 'none' }}>
        {/* Top overlay */}
        <Box
          pos="absolute"
          top={0}
          left={0}
          w="100%"
          h={`${cropData.y}%`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        />

        {/* Bottom overlay */}
        <Box
          pos="absolute"
          top={`${cropData.y + cropData.height}%`}
          left={0}
          w="100%"
          h={`${100 - cropData.y - cropData.height}%`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        />

        {/* Left overlay */}
        <Box
          pos="absolute"
          top={`${cropData.y}%`}
          left={0}
          w={`${cropData.x}%`}
          h={`${cropData.height}%`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        />

        {/* Right overlay */}
        <Box
          pos="absolute"
          top={`${cropData.y}%`}
          left={`${cropData.x + cropData.width}%`}
          w={`${100 - cropData.x - cropData.width}%`}
          h={`${cropData.height}%`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        />
      </Box>

      {/* Crop rectangle */}
      <Box
        pos="absolute"
        top={`${cropData.y}%`}
        left={`${cropData.x}%`}
        w={`${cropData.width}%`}
        h={`${cropData.height}%`}
        style={{
          border: '2px solid #1c7ed6',
          cursor: 'move',
          zIndex: 5,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onTouchStart={(e) => handleMouseDown(e, 'move')}
      />

      {/* Corner handles */}
      <Box style={{ ...handleStyle, top: `${cropData.y}%`, left: `${cropData.x}%`, cursor: 'nw-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'nw')}
           onTouchStart={(e) => handleMouseDown(e, 'nw')} />
      <Box style={{ ...handleStyle, top: `${cropData.y}%`, left: `${cropData.x + cropData.width}%`, cursor: 'ne-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'ne')}
           onTouchStart={(e) => handleMouseDown(e, 'ne')} />
      <Box style={{ ...handleStyle, top: `${cropData.y + cropData.height}%`, left: `${cropData.x}%`, cursor: 'sw-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'sw')}
           onTouchStart={(e) => handleMouseDown(e, 'sw')} />
      <Box style={{ ...handleStyle, top: `${cropData.y + cropData.height}%`, left: `${cropData.x + cropData.width}%`, cursor: 'se-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'se')}
           onTouchStart={(e) => handleMouseDown(e, 'se')} />

      {/* Side handles */}
      <Box style={{ ...handleStyle, top: `${cropData.y}%`, left: `${cropData.x + cropData.width / 2}%`, cursor: 'n-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'n')}
           onTouchStart={(e) => handleMouseDown(e, 'n')} />
      <Box style={{ ...handleStyle, top: `${cropData.y + cropData.height}%`, left: `${cropData.x + cropData.width / 2}%`, cursor: 's-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 's')}
           onTouchStart={(e) => handleMouseDown(e, 's')} />
      <Box style={{ ...handleStyle, top: `${cropData.y + cropData.height / 2}%`, left: `${cropData.x}%`, cursor: 'w-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'w')}
           onTouchStart={(e) => handleMouseDown(e, 'w')} />
      <Box style={{ ...handleStyle, top: `${cropData.y + cropData.height / 2}%`, left: `${cropData.x + cropData.width}%`, cursor: 'e-resize' }}
           onMouseDown={(e) => handleMouseDown(e, 'e')}
           onTouchStart={(e) => handleMouseDown(e, 'e')} />
    </Box>
  );
};

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ dog, onPhotoUpdate }) => {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropData, setCropData] = useState<CropData>({ x: 25, y: 25, width: 50, height: 50 });
  const [isUploading, setIsUploading] = useState(false);
  const [isReCropMode, setIsReCropMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<{ photoUrl: string; originalPhotoUrl: string }> => {
      console.log('Photo upload initiated for:', file.name, formatFileSize(file.size));

      // Step 1: Resize large images for better performance and storage efficiency
      let resizedFile = file;
      if (file.size > 1024 * 1024) { // If larger than 1MB
        console.log('Resizing large image...');
        resizedFile = await resizeImageFile(file, 1200, 1200, 0.85);
        console.log('Resized to:', formatFileSize(resizedFile.size));
      }

      // Step 2: Get presigned URLs for both original (resized) and cropped uploads
      console.log('Getting presigned URLs for uploads...');
      const [originalUploadData, croppedUploadData] = await Promise.all([
        dogsApi.generatePhotoUploadUrl(dog.id, resizedFile.type),
        dogsApi.generateCroppedPhotoUploadUrl(dog.id, resizedFile.type)
      ]);

      // Step 3: Upload the resized original image to S3
      console.log('Uploading original (resized) image...');
      const originalUploadResponse = await fetch(originalUploadData.uploadUrl, {
        method: 'PUT',
        body: resizedFile,
        headers: {
          'Content-Type': resizedFile.type || 'image/jpeg',
        },
      });

      if (!originalUploadResponse.ok) {
        const errorMessage = `Original upload failed: ${originalUploadResponse.status} ${originalUploadResponse.statusText}`;

        // Provide specific guidance for CORS errors
        if (originalUploadResponse.status === 0 || originalUploadResponse.status === 403) {
          throw new Error(`${errorMessage}\n\nThis may be a CORS configuration issue. Please ensure the S3 bucket has proper CORS settings to allow uploads from this origin.`);
        }

        throw new Error(errorMessage);
      }

      // Step 4: Crop the resized image on the client side
      console.log('Cropping image on client...');
      const croppedFile = await cropImageFile(resizedFile, cropData, 800, 0.8);
      console.log('Cropped file size:', formatFileSize(croppedFile.size));

      // Step 5: Upload cropped file to S3 using presigned URL
      console.log('Uploading cropped image...');
      const croppedUploadResponse = await fetch(croppedUploadData.uploadUrl, {
        method: 'PUT',
        body: croppedFile,
        headers: {
          'Content-Type': croppedFile.type || 'image/jpeg',
        },
      });

      if (!croppedUploadResponse.ok) {
        const errorMessage = `Cropped upload failed: ${croppedUploadResponse.status} ${croppedUploadResponse.statusText}`;

        // Provide specific guidance for CORS errors
        if (croppedUploadResponse.status === 0 || croppedUploadResponse.status === 403) {
          throw new Error(`${errorMessage}\n\nThis may be a CORS configuration issue. Please ensure the S3 bucket has proper CORS settings to allow uploads from this origin.`);
        }

        throw new Error(errorMessage);
      }

      // Step 6: Update dog with both photo URLs and crop data
      await dogsApi.update(dog.id, {
        photoUrl: croppedUploadData.photoUrl, // Display version (cropped)
        originalPhotoUrl: originalUploadData.photoUrl, // Original for re-cropping
        photoCrop: cropData, // Store crop data for reference
      });

      return {
        photoUrl: croppedUploadData.photoUrl,
        originalPhotoUrl: originalUploadData.photoUrl
      };
    },    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: 'Photo uploaded successfully! Both original and cropped versions saved.',
        color: 'green',
      });

      // Update the dog with the new photo (display the cropped version)
      if (onPhotoUpdate) {
        onPhotoUpdate(data.photoUrl, cropData);
      }

      // Invalidate dogs cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['dogs'] });

      // Close modal and reset state
      handleClose();
    },
    onError: (error) => {
      console.error('Upload error:', error);

      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for network errors that often indicate CORS issues
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Network error during upload. This is often caused by CORS configuration issues. Please check the S3 bucket CORS settings.';
      }

      notifications.show({
        title: 'Upload Failed',
        message: `Failed to upload photo: ${errorMessage}`,
        color: 'red',
        autoClose: false, // Don't auto-close CORS error messages so user can read them
      });
    },
  });

  // Re-crop mutation for updating crop without re-uploading original
  const reCropMutation = useMutation({
    mutationFn: async (): Promise<{ photoUrl: string }> => {
      if (!dog.originalPhotoUrl) {
        throw new Error('No original photo available for re-cropping');
      }

      console.log('Re-cropping existing photo...');

      // Step 1: Fetch the original image
      const response = await fetch(dog.originalPhotoUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch original image');
      }
      const blob = await response.blob();
      const originalFile = new File([blob], 'original.jpg', { type: 'image/jpeg' });

      // Step 2: Crop the original image on the client side
      const croppedFile = await cropImageFile(originalFile, cropData, 800, 0.8);
      console.log('Cropped file size:', formatFileSize(croppedFile.size));

      // Step 3: Get presigned URL for cropped photo upload
      const croppedUploadData = await dogsApi.generateCroppedPhotoUploadUrl(dog.id, croppedFile.type);

      // Step 4: Upload cropped file to S3
      const croppedUploadResponse = await fetch(croppedUploadData.uploadUrl, {
        method: 'PUT',
        body: croppedFile,
        headers: {
          'Content-Type': croppedFile.type || 'image/jpeg',
        },
      });

      if (!croppedUploadResponse.ok) {
        const errorMessage = `Cropped upload failed: ${croppedUploadResponse.status} ${croppedUploadResponse.statusText}`;
        throw new Error(errorMessage);
      }

      // Step 5: Update dog with new cropped photo URL and crop data
      await dogsApi.update(dog.id, {
        photoUrl: croppedUploadData.photoUrl, // New cropped version
        photoCrop: cropData, // Updated crop data
        // Keep existing originalPhotoUrl unchanged
      });

      return { photoUrl: croppedUploadData.photoUrl };
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: 'Photo re-cropped successfully!',
        color: 'green',
      });

      // Update the dog with the new cropped photo
      if (onPhotoUpdate) {
        onPhotoUpdate(data.photoUrl, cropData);
      }

      // Invalidate dogs cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['dogs'] });

      // Close modal and reset state
      handleClose();
    },
    onError: (error) => {
      console.error('Re-crop error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      notifications.show({
        title: 'Re-crop Failed',
        message: `Failed to re-crop photo: ${errorMessage}`,
        color: 'red',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        notifications.show({
          title: 'Invalid File',
          message: 'Please select an image file',
          color: 'red',
        });
        return;
      }

      // Validate file size (max 10MB - we'll resize on client if needed)
      if (file.size > 10 * 1024 * 1024) {
        notifications.show({
          title: 'File Too Large',
          message: 'Please select an image smaller than 10MB',
          color: 'red',
        });
        return;
      }

      console.log('Selected file:', file.name, formatFileSize(file.size));
      setSelectedFile(file);
      setIsReCropMode(false); // Exit re-crop mode when new file selected

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Reset crop data to center square
      setCropData({ x: 25, y: 25, width: 50, height: 50 });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(selectedFile);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    close();
    setSelectedFile(null);
    setIsReCropMode(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCropData({ x: 25, y: 25, width: 50, height: 50 });
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleEnterReCropMode = () => {
    if (dog.originalPhotoUrl && dog.photoCrop) {
      setIsReCropMode(true);
      setPreviewUrl(dog.originalPhotoUrl);
      setCropData(dog.photoCrop);
    }
  };

  const handleReCrop = async () => {
    setIsUploading(true);
    try {
      await reCropMutation.mutateAsync();
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadDifferentPhoto = () => {
    setIsReCropMode(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCropData({ x: 25, y: 25, width: 50, height: 50 });
  };

  return (
    <>
      <Button
        size="xs"
        variant="light"
        leftSection={<IconCamera size={14} />}
        onClick={() => {
          open();
          // If dog has original photo and crop data, enter re-crop mode
          if (dog.originalPhotoUrl && dog.photoCrop) {
            handleEnterReCropMode();
          }
        }}
        color="blue"
      >
        {dog.photoUrl ? 'Change Photo' : 'Add Photo'}
      </Button>

      <Modal
        opened={opened}
        onClose={handleClose}
        title={`${dog.photoUrl ? 'Change' : 'Add'} Photo for ${dog.name}`}
        size="md"
      >
        <Stack gap="md">
          {/* Re-crop mode: Show original photo with existing crop */}
          {isReCropMode ? (
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Re-crop Existing Photo
              </Text>

              {previewUrl && (
                <InteractiveCrop
                  previewUrl={previewUrl}
                  cropData={cropData}
                  onCropChange={setCropData}
                />
              )}

              <Text size="xs" c="dimmed" ta="center">
                Adjust the crop area and save to update your photo.
                <br />
                The original image will not be re-uploaded.
              </Text>

              <Group justify="space-between">
                <Button variant="subtle" onClick={handleUploadDifferentPhoto}>
                  Upload Different Photo
                </Button>

                <Button
                  onClick={handleReCrop}
                  loading={isUploading}
                  leftSection={<IconUpload size={16} />}
                >
                  Save Crop
                </Button>
              </Group>
            </Stack>
          ) : /* Upload mode: Either new file selected or no file yet */ 
          !selectedFile ? (
            <Stack gap="sm" align="center">
              <Text size="sm" c="dimmed" ta="center">
                Choose a photo for {dog.name}
              </Text>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <Button
                onClick={handleButtonClick}
                leftSection={<IconUpload size={16} />}
                variant="light"
                size="lg"
              >
                Browse Files
              </Button>

              <Text size="xs" c="dimmed" ta="center">
                Maximum file size: 10MB
                <br />
                Supported formats: JPG, PNG, GIF, WebP
                <br />
                Both original and cropped versions will be saved for future editing
              </Text>
            </Stack>
          ) : (
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Preview & Crop New Photo
              </Text>

              {previewUrl && (
                <InteractiveCrop
                  previewUrl={previewUrl}
                  cropData={cropData}
                  onCropChange={setCropData}
                />
              )}

              <Text size="xs" c="dimmed" ta="center">
                Drag the crop area to move it, or drag the handles to resize.
                <br />
                Both original and cropped versions will be saved. You can re-crop later if needed.
              </Text>

              <Group justify="space-between">
                <Button variant="subtle" onClick={() => setSelectedFile(null)}>
                  Choose Different Photo
                </Button>

                <Button
                  onClick={handleUpload}
                  loading={isUploading}
                  leftSection={<IconUpload size={16} />}
                >
                  Upload Photo
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
};
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Group, Stack, Text, Modal, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCamera, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dog, PhotoUploadUrlResponse } from '@my-agility-qs/shared';
import { dogsApi } from '../lib/api';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<{ photoUrl: string }> => {
      console.log('Photo upload initiated for:', file.name);
      
      // Step 1: Get presigned URL from server
      const uploadUrlData: PhotoUploadUrlResponse = await dogsApi.generatePhotoUploadUrl(dog.id, file.type);
      
      // Step 2: Upload file directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      // Step 3: Update dog with photo URL and crop data
      await dogsApi.update(dog.id, {
        photoUrl: uploadUrlData.photoUrl,
        photoCrop: cropData,
      });
      
      return { photoUrl: uploadUrlData.photoUrl };
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: 'Photo uploaded successfully!',
        color: 'green',
      });
      
      // Update the dog with the new photo
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
      notifications.show({
        title: 'Upload Failed',
        message: `Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        notifications.show({
          title: 'File Too Large',
          message: 'Please select an image smaller than 5MB',
          color: 'red',
        });
        return;
      }

      setSelectedFile(file);
      
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

  return (
    <>
      <Button
        size="xs"
        variant="light"
        leftSection={<IconCamera size={14} />}
        onClick={open}
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
          {!selectedFile ? (
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
                Maximum file size: 5MB
                <br />
                Supported formats: JPG, PNG, GIF, WebP
              </Text>
            </Stack>
          ) : (
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Preview & Crop
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
                Darker areas will be cropped out when the photo is displayed.
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
/**
 * Client-side image processing utilities
 */

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop an image file on the client side using Canvas API
 * @param file - The original image file
 * @param cropData - Crop coordinates as percentages (0-100)
 * @param maxWidth - Maximum width for the output image (default: 800px)
 * @param quality - JPEG quality (0-1, default: 0.8)
 * @returns Promise<File> - The cropped image as a new File
 */
export async function cropImageFile(
  file: File,
  cropData: CropData,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create canvas for cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate crop dimensions in pixels
        const cropLeft = Math.round((cropData.x / 100) * img.width);
        const cropTop = Math.round((cropData.y / 100) * img.height);
        const cropWidth = Math.round((cropData.width / 100) * img.width);
        const cropHeight = Math.round((cropData.height / 100) * img.height);

        // Calculate output dimensions maintaining aspect ratio
        let outputWidth = cropWidth;
        let outputHeight = cropHeight;

        if (outputWidth > maxWidth) {
          const ratio = maxWidth / outputWidth;
          outputWidth = maxWidth;
          outputHeight = Math.round(outputHeight * ratio);
        }

        // Set canvas size to output dimensions
        canvas.width = outputWidth;
        canvas.height = outputHeight;

        // Draw the cropped and resized image
        ctx.drawImage(
          img,
          cropLeft, cropTop, cropWidth, cropHeight, // Source rectangle
          0, 0, outputWidth, outputHeight // Destination rectangle
        );

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Create new file with cropped content
            const croppedFile = new File(
              [blob],
              `cropped-${file.name}`,
              {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }
            );

            resolve(croppedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize an image file to reduce its size before upload
 * @param file - The original image file
 * @param maxWidth - Maximum width (default: 1200px)
 * @param maxHeight - Maximum height (default: 1200px)
 * @param quality - JPEG quality (0-1, default: 0.8)
 * @returns Promise<File> - The resized image as a new File
 */
export async function resizeImageFile(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            const resizedFile = new File(
              [blob],
              `resized-${file.name}`,
              {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }
            );

            resolve(resizedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get image dimensions from a file
 * @param file - The image file
 * @returns Promise<{width: number, height: number}> - Image dimensions
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

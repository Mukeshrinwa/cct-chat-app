import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCrop: (croppedFile: File) => void;
  title?: string;
};

type CropBox = {
  x: number;
  y: number;
  size: number;
};

const CROP_SIZE = 512; // Resolution of output cropped image

export function ImageCropperDialog({
  open,
  onClose,
  imageSrc,
  onCrop,
  title = 'Crop Photo',
}: Props) {
  const [imgWidth, setImgWidth] = useState(0);
  const [imgHeight, setImgHeight] = useState(0);
  const [box, setBox] = useState<CropBox>({ x: 0, y: 0, size: 150 });

  const imageRef = useRef<HTMLImageElement>(null);
  const dragInfoRef = useRef<{
    isDragging: boolean;
    action: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null;
    startX: number;
    startY: number;
    startBox: CropBox;
  }>({
    isDragging: false,
    action: null,
    startX: 0,
    startY: 0,
    startBox: { x: 0, y: 0, size: 150 },
  });

  // Reset when dialog opens with new image
  useEffect(() => {
    if (open && imageSrc) {
      setImgWidth(0);
      setImgHeight(0);
    }
  }, [open, imageSrc]);

  // Handle image loading and initialize crop box
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const w = rect.width || img.clientWidth;
    const h = rect.height || img.clientHeight;

    setImgWidth(w);
    setImgHeight(h);

    // Initial crop box as a centered square
    const size = Math.min(w, h) * 0.8;
    setBox({
      x: (w - size) / 2,
      y: (h - size) / 2,
      size,
    });
  };

  // Drag/Resize Start
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    action: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragInfoRef.current = {
      isDragging: true,
      action,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...box },
    };
  };

  // Drag/Resize Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragInfoRef.current;
    if (!drag.isDragging || !drag.action) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { startBox } = drag;

    let newX = startBox.x;
    let newY = startBox.y;
    let newSize = startBox.size;

    if (drag.action === 'move') {
      newX = startBox.x + dx;
      newY = startBox.y + dy;

      // Keep within image boundaries
      newX = Math.max(0, Math.min(imgWidth - box.size, newX));
      newY = Math.max(0, Math.min(imgHeight - box.size, newY));

      setBox((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (drag.action === 'resize-br') {
      // Use horizontal delta primarily for sizing
      newSize = startBox.size + dx;
      const maxSize = Math.min(imgWidth - startBox.x, imgHeight - startBox.y);
      newSize = Math.max(60, Math.min(maxSize, newSize));

      setBox((prev) => ({ ...prev, size: newSize }));
    } else if (drag.action === 'resize-tl') {
      newSize = startBox.size - dx;
      const maxSize = startBox.size + Math.min(startBox.x, startBox.y);
      newSize = Math.max(60, Math.min(maxSize, newSize));

      const diff = newSize - startBox.size;
      newX = startBox.x - diff;
      newY = startBox.y - diff;

      setBox({ x: newX, y: newY, size: newSize });
    } else if (drag.action === 'resize-tr') {
      newSize = startBox.size + dx;
      const maxSize = Math.min(imgWidth - startBox.x, startBox.size + startBox.y);
      newSize = Math.max(60, Math.min(maxSize, newSize));

      const diff = newSize - startBox.size;
      newY = startBox.y - diff;

      setBox((prev) => ({ ...prev, y: newY, size: newSize }));
    } else if (drag.action === 'resize-bl') {
      newSize = startBox.size - dx;
      const maxSize = Math.min(startBox.size + startBox.x, imgHeight - startBox.y);
      newSize = Math.max(60, Math.min(maxSize, newSize));

      const diff = newSize - startBox.size;
      newX = startBox.x - diff;

      setBox((prev) => ({ ...prev, x: newX, size: newSize }));
    }
  };

  // Drag/Resize End
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragInfoRef.current;
    if (drag.isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      drag.isDragging = false;
      drag.action = null;
    }
  };

  // Perform canvas crop and callback
  const handleCropClick = () => {
    const img = imageRef.current;
    if (!img || imgWidth === 0 || imgHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Calculate crop box scaling relative to the image natural dimensions
    const scaleX = img.naturalWidth / imgWidth;
    const scaleY = img.naturalHeight / imgHeight;

    const cropX = box.x * scaleX;
    const cropY = box.y * scaleY;
    const cropWidth = box.size * scaleX;
    const cropHeight = box.size * scaleY;

    // Draw selection to canvas
    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], 'avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onCrop(croppedFile);
          onClose();
        }
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:crop-minimalistic-bold" sx={{ color: 'primary.main' }} />
        <Typography variant="h6">{title}</Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Stack alignItems="center" justifyContent="center" sx={{ mt: 1, minHeight: 280 }}>
          {/* Main Cropper viewport area containing full image */}
          <Box
            sx={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: 360,
              bgcolor: '#1E1E1E',
              borderRadius: 1,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: (theme) => theme.customShadows?.z8,
            }}
          >
            {/* Raw full image */}
            <Box
              component="img"
              ref={imageRef}
              src={imageSrc}
              alt="Source"
              onLoad={handleImageLoad}
              sx={{
                maxWidth: '100%',
                maxHeight: 360,
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            {/* Selection mask layer matching image bounds */}
            {imgWidth > 0 && imgHeight > 0 && (
              <Box
                onPointerMove={handlePointerMove}
                sx={{
                  position: 'absolute',
                  width: imgWidth,
                  height: imgHeight,
                  overflow: 'hidden',
                  touchAction: 'none',
                }}
              >
                {/* Crop Box */}
                <Box
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  onPointerUp={handlePointerUp}
                  sx={{
                    position: 'absolute',
                    left: box.x,
                    top: box.y,
                    width: box.size,
                    height: box.size,
                    border: '2px solid #FFFFFF',
                    boxSizing: 'border-box',
                    cursor: 'move',
                    outline: '9999px solid rgba(0, 0, 0, 0.6)', // dark mask outside
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Circle guidelines inside square box */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: '50%',
                      border: '1.5px dashed rgba(255, 255, 255, 0.75)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Corner Resize Handles */}
                  {/* TL */}
                  <Box
                    onPointerDown={(e) => handlePointerDown(e, 'resize-tl')}
                    onPointerUp={handlePointerUp}
                    sx={{
                      position: 'absolute',
                      left: -5,
                      top: -5,
                      width: 14,
                      height: 14,
                      borderLeft: '4px solid #FFFFFF',
                      borderTop: '4px solid #FFFFFF',
                      cursor: 'nwse-resize',
                      zIndex: 10,
                    }}
                  />
                  {/* TR */}
                  <Box
                    onPointerDown={(e) => handlePointerDown(e, 'resize-tr')}
                    onPointerUp={handlePointerUp}
                    sx={{
                      position: 'absolute',
                      right: -5,
                      top: -5,
                      width: 14,
                      height: 14,
                      borderRight: '4px solid #FFFFFF',
                      borderTop: '4px solid #FFFFFF',
                      cursor: 'nesw-resize',
                      zIndex: 10,
                    }}
                  />
                  {/* BL */}
                  <Box
                    onPointerDown={(e) => handlePointerDown(e, 'resize-bl')}
                    onPointerUp={handlePointerUp}
                    sx={{
                      position: 'absolute',
                      left: -5,
                      bottom: -5,
                      width: 14,
                      height: 14,
                      borderLeft: '4px solid #FFFFFF',
                      borderBottom: '4px solid #FFFFFF',
                      cursor: 'nesw-resize',
                      zIndex: 10,
                    }}
                  />
                  {/* BR */}
                  <Box
                    onPointerDown={(e) => handlePointerDown(e, 'resize-br')}
                    onPointerUp={handlePointerUp}
                    sx={{
                      position: 'absolute',
                      right: -5,
                      bottom: -5,
                      width: 14,
                      height: 14,
                      borderRight: '4px solid #FFFFFF',
                      borderBottom: '4px solid #FFFFFF',
                      cursor: 'nwse-resize',
                      zIndex: 10,
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, textAlign: 'center' }}>
            Drag the box to move, or corners to resize.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" color="primary" onClick={handleCropClick}>
          Crop & Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import React, { useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';

interface ImageUploadProps {
  onImageSelected?: (file: File) => void;
  onImageUpload?: (files: File[]) => void;
  label?: string;
  buttonText?: string;
  dropzoneText?: string;
  accept?: Record<string, string[]>;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelected,
  onImageUpload,
  label = '选择图像',
  buttonText = '选择图像',
  dropzoneText = '拖放图像到此处或点击选择',
  accept = { 'image/*': [] }
}) => {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      onImageSelected?.(file);
      
      if (onImageUpload) {
        onImageUpload(acceptedFiles);
      }
      
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [onImageSelected, onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false
  });

  return (
    <Box>
      {label && (
        <Typography variant="subtitle1" gutterBottom>
          {label}
        </Typography>
      )}
      
      <Box 
        {...getRootProps()} 
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 3,
          mb: 2,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          '&:hover': {
            bgcolor: 'action.hover',
          },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <input {...getInputProps()} />
        
        {preview ? (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <img 
              src={preview} 
              alt="预览" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: 200,
                objectFit: 'contain',
                marginBottom: 8
              }} 
            />
            <Button
              variant="outlined"
              size="small"
              sx={{ mt: 1 }}
            >
              更换图像
            </Button>
          </Box>
        ) : (
          <>
            {isDragActive ? (
              <>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography>释放文件以上传...</Typography>
              </>
            ) : (
              <>
                <ImageIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
                <Typography>{dropzoneText}</Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ mt: 2 }}
                >
                  {buttonText}
                </Button>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default ImageUpload; 
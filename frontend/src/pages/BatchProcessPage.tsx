import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Slider,
  FormHelperText,
  Divider,
  Modal,
  IconButton,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { watermarkAPI } from '../services/api';

const BatchProcessPage: React.FC = () => {
  const [images, setImages] = useState<File[]>([]);
  const [watermarkType, setWatermarkType] = useState<string>('text');
  const [watermarkText, setWatermarkText] = useState<string>('AI 生成');
  const [position, setPosition] = useState<string>('bottom-right');
  const [opacity, setOpacity] = useState<number>(0.3);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [results, setResults] = useState<{url: string, filename: string}[]>([]);

  // 图片预览相关状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 只接受图片文件
    const imageFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/')
    );
    
    setImages(prev => [...prev, ...imageFiles]);
    setError('');
    setSuccess(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    multiple: true
  });

  const handleRemoveImage = (index: number) => {
    setImages(images => images.filter((_, i) => i !== index));
  };

  const handleWatermarkTypeChange = (event: any) => {
    setWatermarkType(event.target.value);
    setError('');
    setSuccess(false);
  };

  const handleWatermarkTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWatermarkText(event.target.value);
  };

  const handlePositionChange = (event: any) => {
    setPosition(event.target.value);
  };

  const handleOpacityChange = (event: any, newValue: number | number[]) => {
    setOpacity(newValue as number);
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      setError('请添加至少一张图像');
      return;
    }

    if (watermarkType === 'text' && !watermarkText) {
      setError('请输入水印文本');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setResults([]);

    try {
      // 准备水印选项
      let response;
      
      // 直接使用正确的参数调用batchProcess API
      if (watermarkType === 'text') {
        // 文本水印
        response = await watermarkAPI.batchProcess(
          images,
          watermarkType,
          watermarkText,
          position,
          opacity
        );
      } else if (watermarkType === 'dct') {
        // DCT隐式水印
        response = await watermarkAPI.batchProcess(
          images,
          watermarkType,
          watermarkText,
          undefined,
          undefined,
          0.1
        );
      } else {
        // 其他水印类型
        response = await watermarkAPI.batchProcess(
          images,
          watermarkType,
          watermarkText
        );
      }

      console.log('批量处理响应:', response);

      if (response.success) {
        setSuccess(true);
        
        // 检查返回的数据结构
        if (response.data && Array.isArray(response.data)) {
          // 如果data直接是数组
          setResults(response.data.map((item: {url?: string, filename?: string}) => ({
            url: item.url || '',
            filename: item.filename || `processed_${Date.now()}.png`
          })));
        } else if (response.data && response.data.results && Array.isArray(response.data.results)) {
          // 如果data包含results数组
          setResults(response.data.results.map((item: {url?: string, filename?: string}) => ({
            url: item.url || '',
            filename: item.filename || `processed_${Date.now()}.png`
          })));
        } else {
          // 如果没有有效的结果数组，返回空数组
          console.error('批量处理响应中没有有效的结果数组:', response);
          setResults([]);
          setError('批量处理成功但未返回结果数据');
        }
      } else {
        setError(response.message || '批量处理失败');
      }
    } catch (err: any) {
      console.error('批量处理错误:', err);
      setError(err.message || '发生错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 打开图片预览
  const handleOpenPreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setPreviewOpen(true);
  };

  // 关闭图片预览
  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        批量处理
      </Typography>
      <Typography variant="body1" paragraph>
        一次性为多张图像添加相同的水印
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>批量处理完成！</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              上传图像
            </Typography>

            <Box 
              {...getRootProps()} 
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 3,
                mb: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
              {isDragActive ? (
                <Typography>释放文件以上传...</Typography>
              ) : (
                <Typography>拖放图像文件到此处，或点击选择文件</Typography>
              )}
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                支持PNG、JPG、GIF等格式图像
              </Typography>
            </Box>

            {images.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  已选择 {images.length} 张图像
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {images.map((file, index) => (
                      <ListItem
                        key={index}
                        secondaryAction={
                          <Button 
                            size="small" 
                            color="error"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <DeleteIcon />
                          </Button>
                        }
                      >
                        <ListItemIcon>
                          <ImageIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary={file.name} 
                          secondary={`${(file.size / 1024).toFixed(1)} KB`} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="watermark-type-label">水印类型</InputLabel>
              <Select
                labelId="watermark-type-label"
                value={watermarkType}
                onChange={handleWatermarkTypeChange}
                label="水印类型"
              >
                <MenuItem value="text">文本水印</MenuItem>
                <MenuItem value="image">图像水印</MenuItem>
                <MenuItem value="dct">DCT隐形水印</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="水印文本"
                variant="outlined"
                value={watermarkText}
                onChange={handleWatermarkTextChange}
                placeholder="请输入水印文本"
              />
            </Box>

            {watermarkType === 'text' && (
              <>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel id="position-label">水印位置</InputLabel>
                  <Select
                    labelId="position-label"
                    value={position}
                    onChange={handlePositionChange}
                    label="水印位置"
                  >
                    <MenuItem value="top-left">左上角</MenuItem>
                    <MenuItem value="top-center">上方居中</MenuItem>
                    <MenuItem value="top-right">右上角</MenuItem>
                    <MenuItem value="middle-left">左侧居中</MenuItem>
                    <MenuItem value="center">中心</MenuItem>
                    <MenuItem value="middle-right">右侧居中</MenuItem>
                    <MenuItem value="bottom-left">左下角</MenuItem>
                    <MenuItem value="bottom-center">下方居中</MenuItem>
                    <MenuItem value="bottom-right">右下角</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ mb: 3 }}>
                  <Typography gutterBottom>透明度</Typography>
                  <Slider
                    value={opacity}
                    onChange={handleOpacityChange}
                    min={0}
                    max={1}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value * 100}%`}
                  />
                  <FormHelperText>调整水印的透明度（0-1）</FormHelperText>
                </Box>
              </>
            )}

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleSubmit}
              disabled={loading || images.length === 0}
            >
              {loading ? <CircularProgress size={24} /> : '开始批量处理'}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              处理结果
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flexDirection: 'column', alignItems: 'center' }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography>正在处理图像，请稍候...</Typography>
              </Box>
            ) : results.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  已成功处理 {results.length} 张图像
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={3}>
                  {results.map((result, index) => (
                    <Grid item xs={12} sm={6} md={6} lg={4} key={index}>
                      <Paper 
                        elevation={2}
                        sx={{ 
                          textAlign: 'center',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 2,
                          overflow: 'hidden',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                          }
                        }}
                      >
                        <Box 
                          sx={{ 
                            position: 'relative',
                            width: '100%',
                            paddingTop: '75%', // 4:3 宽高比
                            overflow: 'hidden'
                          }}
                        >
                          <img 
                            src={result.url} 
                            alt={result.filename}
                            onClick={() => handleOpenPreview(result.url)}
                            style={{ 
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                          />
                          <CheckCircleIcon 
                            color="success" 
                            sx={{ 
                              position: 'absolute', 
                              top: 8, 
                              right: 8,
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              padding: '2px',
                              fontSize: 28
                            }} 
                          />
                        </Box>
                        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <Typography 
                            variant="body2" 
                            noWrap 
                            title={result.filename}
                            sx={{ 
                              mb: 1.5,
                              fontWeight: 500,
                              color: 'text.primary'
                            }}
                          >
                            {result.filename}
                          </Typography>
                          <Button 
                            variant="contained"
                            size="small" 
                            component="a" 
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={result.filename}
                            startIcon={<FileDownloadIcon />}
                            sx={{ 
                              mt: 'auto',
                              textTransform: 'none',
                              borderRadius: 1.5
                            }}
                          >
                            下载图像
                          </Button>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <ImageIcon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
                <Typography>处理后的图像将显示在这里</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 图片预览模态框 */}
      <Modal
        open={previewOpen}
        onClose={handleClosePreview}
        aria-labelledby="图片预览"
        aria-describedby="点击查看大图"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 800,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 2,
          borderRadius: 2,
          outline: 'none',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <IconButton onClick={handleClosePreview} size="small" sx={{ 
              bgcolor: 'rgba(0,0,0,0.05)', 
              '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } 
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            overflow: 'auto',
            maxHeight: 'calc(80vh - 50px)'
          }}>
            <img
              src={previewImage}
              alt="预览大图"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default BatchProcessPage; 
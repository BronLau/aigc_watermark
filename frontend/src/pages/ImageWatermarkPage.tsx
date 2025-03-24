import React, { useState } from 'react';
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
  Slider,
  FormHelperText,
  Alert,
  CircularProgress,
  Modal,
  IconButton,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import { addImageWatermark } from '../services/api';
import { useNavigate } from 'react-router-dom';
import WatermarkSettings from '../components/watermark/WatermarkSettings';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useSnackbar } from 'notistack';

const ImageWatermarkPage: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [position, setPosition] = useState<string>('bottom-right');
  const [opacity, setOpacity] = useState<number>(0.3);
  const [scale, setScale] = useState<number>(0.2);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [watermarkPreview, setWatermarkPreview] = useState<string>('');
  const [resultImage, setResultImage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // 图片预览相关状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 打开图片预览
  const handleOpenPreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setPreviewOpen(true);
  };

  // 关闭图片预览
  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
      setSuccess(false);
      setResultImage('');
    }
  };

  const handlePositionChange = (event: any) => {
    setPosition(event.target.value as string);
    console.log('Position changed to:', event.target.value);
  };

  const handleOpacityChange = (event: any, newValue: number | number[]) => {
    setOpacity(newValue as number);
  };

  const handleScaleChange = (event: any, newValue: number | number[]) => {
    setScale(newValue as number);
  };

  const handleSubmit = async () => {
    if (!image || !watermarkImage) {
      setError('请上传原始图像和水印图像');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', image);
      formData.append('watermark_file', watermarkImage);
      formData.append('position', position);
      formData.append('scale', scale.toString());
      formData.append('opacity', opacity.toString());

      const response = await addImageWatermark(formData);

      if (response.success && response.result_url) {
        setResultImage(response.result_url);
        setSuccess(true);
        enqueueSnackbar('图像水印添加成功！', { variant: 'success' });
      } else {
        throw new Error(response.message || '添加水印失败');
      }
    } catch (error: any) {
      console.error('添加水印失败:', error);
      setError(error.message || '添加水印失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理水印类型切换
  const handleTypeChange = (type: string) => {
    switch(type) {
      case 'text':
        navigate('/text-watermark');
        break;
      case 'invisible':
        navigate('/invisible-watermark');
        break;
      default:
        // 默认是图像水印，当前页面，无需导航
        break;
    }
  };

  const handleSettingsChange = (settings: any) => {
    // 应用水印设置变化
    if (settings.position) {
      setPosition(settings.position);
    }
    if (settings.opacity !== undefined) {
      setOpacity(settings.opacity);
    }
    if (settings.scale !== undefined) {
      setScale(settings.scale);
    }
    if (settings.watermarkImage) {
      setWatermarkImage(settings.watermarkImage);
      setWatermarkPreview(URL.createObjectURL(settings.watermarkImage));
      // 清除错误和成功状态
      setError('');
      setSuccess(false);
    }
  };

  // 处理下载水印图像
  const handleDownload = async () => {
    if (resultImage) {
      try {
        // 获取图像数据
        const response = await fetch(resultImage);
        const blob = await response.blob();
        
        // 创建Blob URL
        const blobUrl = window.URL.createObjectURL(blob);
        
        // 创建下载链接
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `watermarked_${image?.name || 'image'}.png`;
        a.style.display = 'none';
        
        // 添加到DOM，触发下载，然后移除
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 释放Blob URL
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } catch (error) {
        console.error('下载图像时出错:', error);
        setError('下载图像失败');
      }
    }
  };

  return (
    <Box sx={{ maxWidth: "100%" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        图像水印
      </Typography>
      <Typography variant="body1" paragraph>
        为图像添加自定义图像水印，可调整位置、透明度和大小
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 第一行：图像上传和结果预览 */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: 4, 
          borderRadius: 2, 
          border: '1px solid', 
          borderColor: 'divider' 
        }}
      >
        <Grid container spacing={3}>
          {/* 左侧：上传图像 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%'
            }}>
              <Typography variant="h6" gutterBottom>
                上传图像
              </Typography>

              <Box sx={{ mb: 2 }}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload"
                  type="file"
                  onChange={handleImageChange}
                />
                <label htmlFor="image-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<ImageIcon />}
                    fullWidth
                    sx={{ 
                      height: '48px',
                      fontSize: '1rem'
                    }}
                  >
                    选择图像
                  </Button>
                </label>
              </Box>

              {imagePreview ? (
                <Box 
                  sx={{ 
                    flexGrow: 1,
                    position: 'relative',
                    width: '100%',
                    height: '300px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'action.hover',
                    borderRadius: 2,
                    p: 2,
                    overflow: 'hidden'
                  }}
                >
                  <img 
                    src={imagePreview}
                    alt="原始图像"
                    onClick={() => handleOpenPreview(imagePreview)} 
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  />
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    flexGrow: 1,
                    height: '300px',
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'center', 
                    alignItems: 'center',
                    backgroundColor: 'action.hover',
                    borderRadius: 2,
                    p: 2
                  }}
                >
                  <ImageIcon sx={{ fontSize: 60, opacity: 0.3, mb: 1 }} />
                  <Typography>请上传要添加水印的图像</Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* 右侧：处理结果 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%'
            }}>
              <Typography variant="h6" gutterBottom>
                结果预览
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={handleDownload} 
                  startIcon={<FileDownloadIcon />}
                  disabled={!resultImage}
                  fullWidth
                  sx={{ 
                    height: '48px',
                    fontSize: '1rem'
                  }}
                >
                  下载结果
                </Button>
              </Box>

              {loading ? (
                <Box sx={{ 
                  flexGrow: 1,
                  height: '300px',
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  p: 2
                }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    正在处理图像...
                  </Typography>
                </Box>
              ) : resultImage ? (
                <Box sx={{ 
                  flexGrow: 1,
                  position: 'relative',
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  p: 2,
                  overflow: 'hidden'
                }}>
                  {success && (
                    <Box 
                      sx={{ 
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        backgroundColor: 'success.main',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 10
                      }}
                    >
                      <CheckCircleIcon sx={{ mr: 0.5, fontSize: 18 }} />
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        水印添加成功
                      </Typography>
                    </Box>
                  )}
                  <img 
                    src={resultImage} 
                    alt="带水印的图像" 
                    onClick={() => handleOpenPreview(resultImage)}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }} 
                  />
                </Box>
              ) : (
                <Box sx={{ 
                  flexGrow: 1,
                  height: '300px',
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  p: 2
                }}>
                  <ImageIcon sx={{ fontSize: 60, opacity: 0.3, mb: 1 }} />
                  <Typography>处理后的图像将显示在这里</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 第二行：水印设置 */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, width: '100%' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
            <SettingsIcon sx={{ mr: 1 }} />
            水印设置
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={6}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                上传水印图像
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="watermark-image-upload"
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    setWatermarkImage(file);
                    setWatermarkPreview(URL.createObjectURL(file));
                    setError('');
                    setSuccess(false);
                  }
                }}
              />
              <label htmlFor="watermark-image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadFileIcon />}
                  fullWidth
                  sx={{ 
                    height: '48px',
                    fontSize: '1rem'
                  }}
                >
                  选择水印图像
                </Button>
              </label>
              
              {watermarkPreview && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    水印图像预览
                  </Typography>
                  <img 
                    src={watermarkPreview} 
                    alt="水印图像预览" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '150px',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }} 
                  />
                </Box>
              )}
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={6}>
            <Box>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>水印位置</InputLabel>
                <Select
                  value={position}
                  label="水印位置"
                  onChange={handlePositionChange}
                >
                  <MenuItem value="top-left">左上角</MenuItem>
                  <MenuItem value="top-right">右上角</MenuItem>
                  <MenuItem value="bottom-left">左下角</MenuItem>
                  <MenuItem value="bottom-right">右下角</MenuItem>
                  <MenuItem value="center">中心</MenuItem>
                </Select>
              </FormControl>
              
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>水印透明度: {opacity}</Typography>
                <Slider
                  value={opacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleOpacityChange}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                />
              </Box>
              
              <Box>
                <Typography gutterBottom>水印大小: {scale}</Typography>
                <Slider
                  value={scale}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={handleScaleChange}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            图像水印会根据选择的位置和透明度添加到原始图像上，大小比例决定水印图像占原图的比例。
          </Typography>
        </Box>
      </Paper>

      {/* 第三行：操作按钮 */}
      <Box sx={{ textAlign: 'center', mt: 3, mb: 6 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSubmit}
          disabled={loading || !image || !watermarkImage}
          sx={{ 
            minWidth: { xs: '100%', sm: 200 },
            py: 1.5,
            px: 4,
            height: '48px',
            fontSize: '1rem',
            borderRadius: 2
          }}
        >
          {loading ? "处理中..." : "添加水印"}
        </Button>
      </Box>

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
          width: '95%',
          maxWidth: 1200,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 2,
          borderRadius: 2,
          outline: 'none',
          maxHeight: '95vh',
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
            maxHeight: 'calc(95vh - 50px)'
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

export default ImageWatermarkPage; 
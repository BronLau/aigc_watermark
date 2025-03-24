import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  Alert,
  Snackbar,
  Grid,
  CircularProgress,
  Modal,
  IconButton,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import ImageIcon from '@mui/icons-material/Image';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSnackbar } from 'notistack';

import ImageUpload from '../components/watermark/ImageUpload';
import WatermarkSettings from '../components/watermark/WatermarkSettings';
import { addTextWatermark } from '../services/api';

const TextWatermarkPage: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  // 上传的图像
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // 水印设置
  const [watermarkSettings, setWatermarkSettings] = useState({
    text: 'AI 生成',
    position: 'bottom-right',
    opacity: 0.3,
    fontSize: 36,
  });
  
  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // 处理结果
  const [watermarkedImageUrl, setWatermarkedImageUrl] = useState<string | null>(null);

  // 图片预览相关状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  
  // 处理图片上传
  const handleImageUpload = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setOriginalImage(file);
      setImagePreview(URL.createObjectURL(file));
      // 清除之前的结果
      setWatermarkedImageUrl(null);
      setError(null);
    }
  };
  
  // 处理文件输入变化
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setOriginalImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
      setSuccess(false);
      setWatermarkedImageUrl(null);
    }
  };
  
  // 处理水印设置变化
  const handleSettingsChange = (settings: any) => {
    setWatermarkSettings(settings);
  };
  
  // 处理水印类型切换
  const handleTypeChange = (type: string) => {
    switch(type) {
      case 'image':
        navigate('/image-watermark');
        break;
      case 'invisible':
        navigate('/invisible-watermark');
        break;
      default:
        // 默认是文本水印，当前页面，无需导航
        break;
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
  
  // 处理添加水印
  const handleAddWatermark = async () => {
    if (!originalImage) {
      setError('请先上传图片');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('开始添加水印，参数:', {
        image: originalImage.name,
        size: originalImage.size,
        text: watermarkSettings.text,
        position: watermarkSettings.position,
        opacity: watermarkSettings.opacity,
        fontSize: watermarkSettings.fontSize
      });
      
      const formData = new FormData();
      formData.append('file', originalImage);
      formData.append('text', watermarkSettings.text);
      formData.append('position', watermarkSettings.position);
      formData.append('opacity', watermarkSettings.opacity.toString());
      formData.append('scale', watermarkSettings.fontSize.toString());
      
      const result = await addTextWatermark(formData);
      
      console.log('收到添加水印响应:', result);
      console.log('响应数据类型:', typeof result);
      console.log('响应字段:', Object.keys(result));
      
      // 检查响应中是否有正确的URL字段
      if (result.success) {
        console.log('水印添加成功');
        
        // 首先尝试使用result_url字段
        if (result.result_url) {
          console.log('获取到结果URL(result_url):', result.result_url);
          setWatermarkedImageUrl(result.result_url);
        }
        // 然后尝试使用image_url字段（作为备选）
        else if (result.image_url) {
          console.log('使用兼容模式(image_url):', result.image_url);
          setWatermarkedImageUrl(result.image_url);
        }
        // 如果两个字段都没有
        else {
          console.error('响应中没有有效的图片URL');
          throw new Error('处理成功但未返回图片URL');
        }
        
        // 确认状态更新
        setTimeout(() => {
          console.log('当前水印图片URL状态:', watermarkedImageUrl);
        }, 100);
        
        setSuccess(true);
        enqueueSnackbar('文本水印添加成功！', { variant: 'success' });
      } else {
        throw new Error(result.message || '添加水印失败');
      }
    } catch (err: any) {
      console.error('添加水印失败:', err);
      setError(err.response?.data?.detail || err.message || '添加水印失败');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 处理下载水印图像
  const handleDownload = async () => {
    if (watermarkedImageUrl) {
      try {
        // 获取图像数据
        const response = await fetch(watermarkedImageUrl);
        const blob = await response.blob();
        
        // 创建Blob URL
        const blobUrl = window.URL.createObjectURL(blob);
        
        // 创建下载链接
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `watermarked_${originalImage?.name || 'image'}.png`;
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
  
  // 处理关闭成功提示
  const handleCloseSuccess = () => {
    setSuccess(false);
  };

  return (
    <Box sx={{ maxWidth: "100%" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        文本水印
      </Typography>
      <Typography variant="body1" paragraph>
        为图像添加自定义文本水印，可调整位置、透明度和文字大小
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
                    alt="预览图像" 
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
                  disabled={!watermarkedImageUrl}
                  fullWidth
                  sx={{ 
                    height: '48px',
                    fontSize: '1rem'
                  }}
                >
                  下载结果
                </Button>
              </Box>

              {isProcessing ? (
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
              ) : watermarkedImageUrl ? (
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
                    src={watermarkedImageUrl} 
                    alt="带水印的图像" 
                    onClick={() => handleOpenPreview(watermarkedImageUrl)}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }} 
                    onLoad={() => console.log('水印图片加载成功')}
                    onError={(e) => {
                      console.error('水印图片加载失败:', e);
                      setError('水印图片加载失败，请重试');
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
        <WatermarkSettings
          watermarkType="text"
          onTypeChange={handleTypeChange}
          onSettingsChange={handleSettingsChange}
        />
      </Paper>

      {/* 第三行：操作按钮 */}
      <Box sx={{ textAlign: 'center', mt: 3, mb: 6 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleAddWatermark}
          disabled={isProcessing || !originalImage}
          sx={{ 
            minWidth: { xs: '100%', sm: 200 },
            py: 1.5,
            px: 4,
            borderRadius: 2
          }}
        >
          {isProcessing ? "处理中..." : "添加水印"}
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

export default TextWatermarkPage; 
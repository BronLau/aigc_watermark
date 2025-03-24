import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Slider,
  FormHelperText,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Modal,
  IconButton,
  Divider,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { 
  addInvisibleWatermark,
  AlgorithmTypes
} from '../services/api';
import { useNavigate } from 'react-router-dom';
import ImageUpload from '../components/watermark/ImageUpload';
import { useSnackbar } from 'notistack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// 不可见水印算法选项
const algorithms = [
  { value: 'dwt', label: 'DWT (离散小波变换)', description: '离散小波变换(DWT)水印算法是一种多尺度分析技术，通过在图像的频域中嵌入水印，具有良好的鲁棒性和不可见性。' },
];

const InvisibleWatermarkPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [image, setImage] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState<string>('AI 生成');
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<string>('text'); // text 或 image
  const [alpha, setAlpha] = useState<number>(0.1);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [watermarkImagePreview, setWatermarkImagePreview] = useState<string>('');
  const [resultImage, setResultImage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const navigate = useNavigate();

  // 图片预览相关状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

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

  const handleImageUpload = (files: File[]) => {
    if (files && files.length > 0) {
      const file = files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
      setSuccess(false);
      setResultImage('');
    }
  };

  const handleWatermarkImageUpload = (files: File[]) => {
    if (files && files.length > 0) {
      const file = files[0];
      setWatermarkImage(file);
      setWatermarkImagePreview(URL.createObjectURL(file));
      setError('');
      setSuccess(false);
    }
  };

  const handleWatermarkTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWatermarkText(event.target.value);
    setError('');
    setSuccess(false);
  };

  const handleWatermarkTypeChange = (event: SelectChangeEvent) => {
    setWatermarkType(event.target.value);
    setError('');
    setSuccess(false);
  };

  const handleAlphaChange = (event: any, newValue: number | number[]) => {
    setAlpha(newValue as number);
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('请先上传原始图像');
      return;
    }

    if (watermarkType === 'text' && !watermarkText.trim()) {
      setError('水印文本不能为空');
      return;
    }

    if (watermarkType === 'image' && !watermarkImage) {
      setError('请先上传水印图像');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess(false);
      setResultImage('');

      console.log('添加水印参数:', {
        图像: image?.name,
        类型: watermarkType,
        文本: watermarkType === 'text' ? watermarkText : '',
        图像水印: watermarkType === 'image' ? watermarkImage?.name : '',
        强度: alpha,
        算法: algorithms[0].value as AlgorithmTypes
      });

      try {
        // 调用API
        const response = await addInvisibleWatermark(
          image,
          watermarkType === 'text' ? watermarkText : '',
          watermarkType === 'image' ? watermarkImage : null,
          alpha,
          algorithms[0].value as AlgorithmTypes
        );
        console.log('水印添加响应:', response);
        
        if (response.success) {
          setSuccess(true);
          setResultImage(response.url);
          console.log('获取到结果图像URL:', response.url);
          
          enqueueSnackbar(`${watermarkType === 'text' ? '文本' : '图像'}隐式水印添加成功！`, { variant: 'success' });
        } else {
          setError(response.message || '水印添加失败');
          enqueueSnackbar('添加水印失败: ' + response.message, { variant: 'error' });
        }
      } catch (err: any) {
        console.error('添加水印错误:', err);
        setError(err.message || '发生错误，请重试');
        enqueueSnackbar('添加水印时发生错误，请稍后重试', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('添加水印错误:', err);
      setError(err.message || '发生错误，请重试');
      enqueueSnackbar('添加水印时发生错误，请稍后重试', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 处理类型切换
  const handleTypeChange = (type: string) => {
    switch(type) {
      case 'text':
        navigate('/text-watermark');
        break;
      case 'image':
        navigate('/image-watermark');
        break;
      default:
        // 默认是隐式水印，当前页面，无需导航
        break;
    }
  };

  // 处理水印设置变化
  const handleSettingsChange = (settings: any) => {
    // 实现设置变化处理
    if (settings.text) {
      setWatermarkText(settings.text);
    }
    if (settings.alpha !== undefined) {
      setAlpha(settings.alpha);
    }
  };

  // 处理水印图像下载
  const handleDownload = async () => {
    if (resultImage) {
      try {
        // 检查是否已经是Blob URL
        if (resultImage.startsWith('blob:')) {
          // 直接使用Blob URL下载
          const a = document.createElement('a');
          a.href = resultImage;
          a.download = `invisible_watermarked_${image?.name || 'image'}.png`;
          a.style.display = 'none';
          
          // 添加到DOM，触发下载，然后移除
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          // 获取图像数据
          const response = await fetch(resultImage);
          if (!response.ok) {
            throw new Error(`图像加载失败: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          
          // 创建Blob URL
          const blobUrl = window.URL.createObjectURL(blob);
          
          // 创建下载链接
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `invisible_watermarked_${image?.name || 'image'}.png`;
          a.style.display = 'none';
          
          // 添加到DOM，触发下载，然后移除
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // 释放Blob URL
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
        }
        
        enqueueSnackbar('图像下载成功', { variant: 'success' });
      } catch (error) {
        console.error('下载图像时出错:', error);
        setError('下载图像失败');
        enqueueSnackbar('下载图像失败', { variant: 'error' });
      }
    } else {
      enqueueSnackbar('没有可下载的图像', { variant: 'warning' });
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
    <Box sx={{ maxWidth: "100%" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        隐式水印
      </Typography>
      <Typography variant="body1" paragraph>
        为图像添加不可见的数字水印，支持文本和图像水印
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
            <Typography variant="h6" gutterBottom>
              上传图像
            </Typography>
            <Button
              variant="contained"
              component="label"
              fullWidth
              startIcon={<UploadFileIcon />}
              sx={{ 
                bgcolor: 'primary.main',
                mb: 2,
                height: '48px',
                fontSize: '1rem'
              }}
            >
              选择图像
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageChange}
              />
            </Button>

            {imagePreview ? (
              <Box 
                sx={{ 
                  position: 'relative',
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <img 
                  src={imagePreview} 
                  alt="预览" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain'
                  }} 
                />
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'background.paper',
                    boxShadow: 1
                  }}
                  onClick={() => {
                    setImage(null);
                    setImagePreview('');
                    setResultImage('');
                    setSuccess(false);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Box 
                sx={{ 
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  textAlign: 'center'
                }}
              >
                <Typography color="text.secondary">
                  请上传要添加水印的图像
                </Typography>
              </Box>
            )}
          </Grid>

          {/* 右侧：结果预览 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              处理结果
            </Typography>
            
            <Button
              variant="contained"
              fullWidth
              startIcon={<FileDownloadIcon />}
              onClick={handleDownload}
              disabled={!resultImage}
              sx={{ 
                bgcolor: 'primary.main',
                mb: 2,
                height: '48px',
                fontSize: '1rem'
              }}
            >
              下载结果
            </Button>

            {resultImage ? (
              <Box 
                sx={{ 
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <img 
                  src={resultImage} 
                  alt="结果" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain'
                  }} 
                />
              </Box>
            ) : (
              <Box 
                sx={{ 
                  width: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  textAlign: 'center'
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={40} sx={{ mr: 2 }} />
                    <Typography>处理中...</Typography>
                  </>
                ) : (
                  <Typography color="text.secondary">
                    处理后的图片将显示在这里
                  </Typography>
                )}
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* 第二行：水印设置 */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SecurityIcon sx={{ mr: 1 }} />
          <Typography variant="h6">
            水印设置
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* 水印类型选择 */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>水印类型</InputLabel>
              <Select
                value={watermarkType}
                onChange={handleWatermarkTypeChange}
                label="水印类型"
              >
                <MenuItem value="text">文本水印</MenuItem>
                <MenuItem value="image">图像水印</MenuItem>
              </Select>
              <FormHelperText>选择要添加的水印类型</FormHelperText>
            </FormControl>
            
            {/* 水印内容区域 */}
            {watermarkType === 'text' ? (
              <TextField
                fullWidth
                label="水印文本"
                variant="outlined"
                value={watermarkText}
                onChange={handleWatermarkTextChange}
                helperText="输入要嵌入的水印文本"
              />
            ) : (
              <Box>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="watermark-upload"
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setWatermarkImage(e.target.files[0]);
                      setWatermarkImagePreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                />
                <label htmlFor="watermark-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<ImageIcon />}
                    fullWidth
                    sx={{
                      height: '48px',
                      fontSize: '1rem'
                    }}
                  >
                    选择水印图像
                  </Button>
                </label>
                
                {watermarkImagePreview && (
                  <Box 
                    sx={{ 
                      mt: 2,
                      position: 'relative',
                      width: '100%',
                      height: '100px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={watermarkImagePreview} 
                      alt="水印图像" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain'
                      }} 
                    />
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'background.paper',
                        boxShadow: 1
                      }}
                      onClick={() => {
                        setWatermarkImage(null);
                        setWatermarkImagePreview('');
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            )}
          </Grid>
          
          {/* 水印参数设置 */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                水印强度: {alpha.toFixed(2)}
              </Typography>
              <Slider
                value={alpha}
                onChange={handleAlphaChange}
                valueLabelDisplay="auto"
                min={0.01}
                max={0.5}
                step={0.01}
              />
              <Typography variant="body2" color="text.secondary">
                调整水印强度，值越大水印越清晰但可能越明显
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>水印算法</InputLabel>
                <Select
                  value="dwt"
                  label="水印算法"
                  disabled
                >
                  <MenuItem value="dwt">DWT (离散小波变换)</MenuItem>
                </Select>
                <FormHelperText>
                  DWT算法具有良好的鲁棒性和不可见性
                </FormHelperText>
              </FormControl>
            </Box>
          </Grid>
        </Grid>
        
        {/* 添加水印按钮（居中显示在最下方） */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            color="primary"
            disabled={loading || !image || (watermarkType === 'text' && !watermarkText) || (watermarkType === 'image' && !watermarkImage)}
            onClick={handleSubmit}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              height: '48px',
              borderRadius: 6
            }}
          >
            {loading ? '添加中...' : '添加水印'}
          </Button>
        </Box>
      </Paper>

      {/* 图片预览模态框 */}
      <Modal
        open={previewOpen}
        onClose={handleClosePreview}
        aria-labelledby="preview-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 0,
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          <Box sx={{ position: 'relative' }}>
            <IconButton
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
              }}
              onClick={handleClosePreview}
            >
              <CloseIcon />
            </IconButton>
            <img
              src={previewImage}
              alt="图片预览"
              style={{
                width: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default InvisibleWatermarkPage; 
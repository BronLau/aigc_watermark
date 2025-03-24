import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Typography, 
  Paper,
  Divider, 
  Alert,
  AlertTitle,
  Chip,
  Grid,
  Modal,
  IconButton,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import { useSnackbar } from 'notistack';
import { API_URL } from '../constants';
import { extractInvisibleWatermark } from '../services/api';

// 水印结果接口定义
interface WatermarkResult {
  success: boolean;
  detected: boolean;
  watermarkText: string;
  watermarkImageUrl: string;
  confidence: number;
  watermarkType: string | null;
  message?: string; // 添加消息字段
}

const ExtractWatermarkPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 选择文件处理
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      
      // 创建预览URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // 预览处理
  const handleOpenPreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  // 清理资源
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 监控result变化记录调试信息
  useEffect(() => {
    if (result && result.watermarkType === 'image') {
      console.log('渲染图像水印:', result.watermarkImageUrl);
      
      // 确保图像URL格式正确
      if (result.watermarkImageUrl && result.watermarkImageUrl.startsWith('/static/')) {
        const fullUrl = `${API_URL}${result.watermarkImageUrl}`;
        console.log('完整图像URL:', fullUrl);
      }
    }
  }, [result]);

  // 提取水印处理函数
  const handleExtract = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    if (!selectedFile) {
      enqueueSnackbar('请选择图像文件', { 
        variant: 'warning',
        autoHideDuration: 3000
      });
      return;
    }
    
    setLoading(true);
    setResult(null);
    setError('');
    
    const formData = new FormData();
    formData.append('image_file', selectedFile);

    try {
      // 使用DWT算法提取水印
      const response = await extractInvisibleWatermark(formData, 'dwt');
      console.log('提取水印完整响应:', response);
      
      // 创建结果数据对象
      const resultData: WatermarkResult = {
        success: response.success,
        detected: response.detected || false,
        watermarkText: response.watermark_text || '',
        watermarkImageUrl: response.watermark_image_url || '',
        confidence: response.confidence || 0,
        watermarkType: response.watermark_type || null,
        message: response.message || '' // 添加消息
      };

      console.log('提取结果数据:', resultData);
      console.log('水印类型:', resultData.watermarkType);
      console.log('水印图像URL:', resultData.watermarkImageUrl);
      
      // 首先检查是否为可能含有图像水印的空文本水印
      if (response.success && response.detected && 
          response.watermark_type === 'text' && !response.watermark_text && 
          response.may_contain_image_watermark) {
        console.log('检测到可能包含图像水印的空文本水印，尝试提取图像水印');
        
        // 强制设置为图像类型以触发图像水印组件显示
        resultData.watermarkType = 'image';
        resultData.watermarkImageUrl = '/static/extracting_watermark.png';  // 临时URL
        
        setResult(resultData);
        
        // 显示正在处理的提示
        enqueueSnackbar('检测到隐藏的图像水印，正在提取...', { 
          variant: 'info',
          autoHideDuration: 3000
        });
        
        // 稍后自动触发提取图像水印
        setTimeout(async () => {
          try {
            const imageFormData = new FormData();
            imageFormData.append('image_file', selectedFile);
            const imageResponse = await extractInvisibleWatermark(imageFormData, 'dwt');
            
            if (imageResponse.success && imageResponse.detected && 
                imageResponse.watermark_type === 'image' && imageResponse.watermark_image_url) {
              // 更新结果数据
              setResult(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  watermarkImageUrl: imageResponse.watermark_image_url,
                  confidence: imageResponse.confidence || prev.confidence
                };
              });
              
              enqueueSnackbar('成功提取到图像水印', { 
                variant: 'success',
                autoHideDuration: 3000
              });
            }
          } catch (error) {
            console.error('提取图像水印失败:', error);
          }
        }, 500);
        
        setLoading(false);
        return;
      }
      
      // 首先检查提取是否成功和是否检测到水印
      if (response.success && response.detected) {
        // 检查水印类型
        if (resultData.watermarkType === 'image' && resultData.watermarkImageUrl) {
          // 图像水印处理
          console.log(`图像水印URL路径: ${resultData.watermarkImageUrl}`);
          enqueueSnackbar('成功提取到图像水印', { 
            variant: 'success',
            autoHideDuration: 3000
          });
        } else if (resultData.watermarkType === 'text' && resultData.watermarkText) {
          // 文本水印处理
          enqueueSnackbar('成功提取到文本水印', { 
            variant: 'success',
            autoHideDuration: 3000
          });
        } else {
          // 未知情况处理
          enqueueSnackbar(resultData.message || '成功提取到水印，但类型或内容不明确', { 
            variant: 'info',
            autoHideDuration: 3000
          });
        }
      } else {
        // 未检测到水印
        enqueueSnackbar(response.message || '未检测到水印', { 
          variant: 'info',
          autoHideDuration: 3000
        });
      }

      setResult(resultData);
    } catch (error) {
      console.error('提取水印时发生错误:', error);
      setError(error instanceof Error ? error.message : '提取水印失败');
      enqueueSnackbar('提取水印失败，请重试', { 
        variant: 'error',
        autoHideDuration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // 在显示提取文本的部分，添加对特殊字符的过滤和处理
  const formatExtractedText = (text: string): string => {
    if (!text) return "";
    
    // 过滤掉不可打印字符，但保留中文等字符
    const printableText = text.split('').filter(char => {
      const code = char.charCodeAt(0);
      // 保留ASCII可打印字符和中文字符
      return (code > 31 && code < 127) || // ASCII可打印字符
             (code >= 0x4e00 && code <= 0x9fff); // 中文字符范围
    }).join('');
    
    // 如果过滤后的文本太短或没有有效内容，但原始文本较长
    if ((printableText.length < 2 || !/[A-Za-z0-9\u4e00-\u9fff]/.test(printableText)) && text.length > 2) {
      return `${text} (可能包含不可显示字符)`;
    }
    
    return printableText;
  };

  return (
    <Box sx={{ maxWidth: "100%" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        提取水印
      </Typography>
      <Typography variant="body1" paragraph>
        从已添加水印的图像中提取隐藏的水印信息，支持提取文本和图像水印
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>提取失败</AlertTitle>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Grid container spacing={3}>
          {/* 上传图像区域 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              上传图像
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              选择要提取水印的图像文件
            </Typography>

            <Box sx={{ mt: 2, mb: 3 }}>
              {previewUrl ? (
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <img 
                    src={previewUrl} 
                    alt="预览" 
                    style={{ 
                      width: '100%', 
                      maxHeight: '260px', 
                      objectFit: 'contain',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenPreview(previewUrl)}
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
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    bgcolor: 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                      cursor: 'pointer'
                    },
                    height: '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <UploadFileIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.6, mb: 2 }} />
                  <Typography variant="body1" gutterBottom>
                    点击上传图像
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    支持JPG, PNG等常见图像格式
                  </Typography>
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              fullWidth
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleExtract}
              disabled={!selectedFile || loading}
            >
              {loading ? '提取中...' : '提取水印'}
            </Button>
          </Grid>

          {/* 提取结果区域 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              提取结果
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {result ? (
                result.detected ? '成功提取水印信息' : '未在图像中检测到水印'
              ) : (
                '上传图像并点击提取按钮'
              )}
            </Typography>

            {/* 水印提取结果区域 */}
            {result ? (
              <Card
                variant="outlined" 
                sx={{ 
                  mt: 2, 
                  borderColor: result.detected ? 'success.main' : 'warning.main',
                  bgcolor: result.detected ? 'success.light' : 'warning.light',
                  opacity: 0.9
                }}
              >
                <CardHeader 
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {result.detected ? (
                        <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                      ) : (
                        <ErrorIcon sx={{ mr: 1, color: 'warning.main' }} />
                      )}
                      <Typography variant="h6">
                        {result.detected 
                          ? `${result.watermarkType === 'image' ? '图像水印' : '文本水印'} 提取结果` 
                          : '未检测到水印'}
                      </Typography>
                    </Box>
                  }
                  action={
                    <Chip 
                      label={`置信度: ${Math.round(result.confidence * 100)}%`}
                      color={result.confidence > 0.7 ? "success" : result.confidence > 0.4 ? "warning" : "error"}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  }
                />
                <CardContent>
                  {/* 图像水印显示 */}
                  {result.watermarkType === 'image' && result.watermarkImageUrl && (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        提取的图像水印:
                      </Typography>
                      <Box 
                        sx={{ 
                          display: 'inline-block', 
                          p: 2, 
                          bgcolor: 'common.white',  // 使用纯白色背景
                          borderRadius: 1,
                          boxShadow: 1,
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: 'divider',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onClick={() => handleOpenPreview(`${result.watermarkImageUrl}`)}
                      >
                        <Box sx={{ position: 'relative', minWidth: '128px', minHeight: '128px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {/* 加载图像前显示加载指示器 */}
                          <CircularProgress size={40} sx={{ position: 'absolute', opacity: 0.7 }} />
                          
                          <img 
                            src={result.watermarkImageUrl && (result.watermarkImageUrl.startsWith('/') || result.watermarkImageUrl.startsWith('http')) 
                              ? `${result.watermarkImageUrl.startsWith('http') ? '' : API_URL}${result.watermarkImageUrl}?t=${Date.now()}` 
                              : result.watermarkImageUrl} 
                            alt="提取的水印"
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '150px',
                              margin: '0 auto',
                              display: 'block',
                              border: '1px solid rgba(0,0,0,0.1)',
                              backgroundColor: '#ffffff',
                              imageRendering: 'pixelated',  // 使用像素化渲染增强图像清晰度
                              borderRadius: '2px',
                              padding: '2px',
                              position: 'relative',
                              zIndex: 2
                            }}
                            onLoad={(e) => {
                              console.log('水印图像加载成功');
                              // 图像加载成功后应用增强效果
                              const img = e.target as HTMLImageElement;
                              img.style.opacity = '1';
                              
                              // 隐藏加载指示器
                              const parent = img.parentElement;
                              if (parent) {
                                const loadingIndicator = parent.querySelector('circle');
                                const progressElement = loadingIndicator?.parentElement;
                                if (progressElement && progressElement instanceof HTMLElement) {
                                  progressElement.style.display = 'none';
                                }
                              }
                            }}
                            onError={(e) => {
                              console.error('图像加载错误:', e);
                              console.log('尝试加载的图像URL:', result.watermarkImageUrl);
                              
                              // 获取目标图像元素
                              const targetImg = e.target as HTMLImageElement;
                              
                              // 重新尝试加载使用时间戳避免缓存
                              const currentSrc = targetImg.src;
                              if (!currentSrc.includes('?t=') && (currentSrc.startsWith('http') || currentSrc.includes('/static/'))) {
                                console.log('尝试添加时间戳重新加载图像');
                                const timestamp = Date.now();
                                targetImg.src = `${currentSrc}${currentSrc.includes('?') ? '&' : '?'}t=${timestamp}`;
                                return;
                              }
                              
                              // 隐藏加载指示器
                              const parent = targetImg.parentElement;
                              if (parent) {
                                const loadingIndicator = parent.querySelector('circle');
                                const progressElement = loadingIndicator?.parentElement;
                                if (progressElement && progressElement instanceof HTMLElement) {
                                  progressElement.style.display = 'none';
                                }
                              }
                              
                              // 显示错误占位图
                              targetImg.style.width = '128px';
                              targetImg.style.height = '128px';
                              targetImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2YxZjFmMSIgLz48cGF0aCBkPSJNMjAsMjAgTDEwOCwxMDggTTIwLDEwOCBMMTA4LDIwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iNCIgLz48dGV4dCB4PSI2NCIgeT0iNjQiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjI1IiBmaWxsPSIjMDAwIj7mnKrorr/liLDlm77lg4/msLTljbA8L3RleHQ+PC9zdmc+';
                            }}
                          />
                        </Box>
                        
                        {!result.detected && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: 'block', 
                              mt: 1, 
                              color: 'warning.main'
                            }}
                          >
                            未检测到有效的图像水印
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        点击可放大查看
                      </Typography>
                    </Box>
                  )}
                  
                  {/* 文本水印显示 */}
                  {result.watermarkType === 'text' && result.watermarkText && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        提取的文本:
                      </Typography>
                      <Paper 
                        elevation={0} 
                        sx={{ 
                          p: 2, 
                          bgcolor: 'background.paper', 
                          borderRadius: 1,
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}
                      >
                        <Typography 
                          variant="body1" 
                          component="pre"
                          sx={{ 
                            fontFamily: 'monospace', 
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            m: 0
                          }}
                        >
                          {formatExtractedText(result.watermarkText)}
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* 未检测到水印的情况 */}
                  {!result.detected && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      在图像中未能检测到有效的水印信息
                    </Alert>
                  )}
                  
                  {/* 额外信息 */}
                  <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip 
                      size="small" 
                      color="primary" 
                      label="算法: DWT"
                    />
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Box 
                sx={{ 
                  mt: 2, 
                  p: 4, 
                  border: '1px dashed', 
                  borderColor: 'divider', 
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  height: '260px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'column'
                }}
              >
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  align="center"
                >
                  {loading 
                    ? '正在提取水印，请稍候...' 
                    : '提取结果将在这里显示'
                  }
                </Typography>
                {loading && <CircularProgress sx={{ mt: 2 }} />}
              </Box>
            )}
          </Grid>
        </Grid>
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
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                zIndex: 10
              }}
              onClick={handleClosePreview}
            >
              <CloseIcon />
            </IconButton>
            {previewImage && (
              <img
                src={previewImage.startsWith('/') ? `${API_URL}${previewImage}?t=${Date.now()}` : previewImage}
                alt="图片预览"
                style={{
                  width: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  display: 'block',
                  backgroundColor: previewImage.includes('/static/') ? '#000' : '#fff', // 使用黑色背景增强彩色马赛克图像的显示效果
                  padding: '10px',
                  imageRendering: 'auto' // 使用浏览器默认渲染
                }}
                onLoad={(e) => {
                  console.log('预览图像加载成功');
                  
                  const img = e.target as HTMLImageElement;
                  img.style.opacity = '1';
                  img.style.transition = 'filter 0.3s ease';
                  
                  // 图像过滤器效果
                  if (previewImage.includes('/static/extracted_watermark_') || previewImage.includes('/static/forced_extract_wm_')) {
                    // 对于提取的水印图像，应用特殊滤镜增强显示
                    img.style.filter = 'contrast(1.3) brightness(1.1) saturate(1.2)';
                    img.style.imageRendering = 'pixelated'; // 像素化渲染
                    
                    // 添加鼠标互动增强效果
                    img.addEventListener('mouseover', () => {
                      img.style.filter = 'contrast(1.6) brightness(1.3) saturate(1.5)';
                    });
                    img.addEventListener('mouseout', () => {
                      img.style.filter = 'contrast(1.3) brightness(1.1) saturate(1.2)';
                    });
                  }
                }}
                onError={(e) => {
                  console.error('预览图像加载错误:', e);
                  console.log('原始图像URL:', previewImage);
                  console.log('尝试加载的URL:', previewImage.startsWith('/') ? `${API_URL}${previewImage}` : previewImage);
                  
                  // 添加时间戳参数尝试避免缓存问题
                  if (previewImage.startsWith('/static/')) {
                    console.log('尝试使用不同格式的静态URL');
                    const timestamp = Date.now();
                    const newUrl = `${API_URL}${previewImage}?t=${timestamp}`;
                    console.log('添加时间戳的新URL:', newUrl);
                    (e.target as HTMLImageElement).src = newUrl;
                    return;
                  }
                  
                  // 最终显示彩色占位图
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjMyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM0Y2FmNTAiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjOGJjMzRhIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIzMjAiIGhlaWdodD0iMzIwIiBmaWxsPSIjZjVmNWY1IiAvPjxyZWN0IHg9IjYwIiB5PSI2MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9InVybCgjZ3JhZCkiIC8+PHRleHQgeD0iMTYwIiB5PSIxNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiPldBVEVSTUFSSyBJTUFHRTwvdGV4dD48dGV4dCB4PSIxNjAiIHk9IjE5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIj7lm77lj6PlkIjmiJDmlbDmja7lt7Lmj5DlsZU8L3RleHQ+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIzMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSI0IiAvPjwvc3ZnPg==';
                }}
              />
            )}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default ExtractWatermarkPage; 
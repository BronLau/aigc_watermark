import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Container,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import ImageIcon from '@mui/icons-material/Image';
import SecurityIcon from '@mui/icons-material/Security';
import SearchIcon from '@mui/icons-material/Search';
import LayersIcon from '@mui/icons-material/Layers';
import InfoIcon from '@mui/icons-material/Info';

const HomePage: React.FC = () => {
  const features = [
    {
      title: '文本水印',
      description: '为图像添加自定义文本水印，支持调整位置、透明度和字体大小',
      icon: <TextFormatIcon sx={{ fontSize: 40 }} />,
      path: '/text-watermark',
      color: '#3f51b5',
    },
    {
      title: '图像水印',
      description: '添加自定义图片作为水印，可调整位置、透明度和大小',
      icon: <ImageIcon sx={{ fontSize: 40 }} />,
      path: '/image-watermark',
      color: '#f50057',
    },
    {
      title: '隐式水印',
      description: '使用DCT算法嵌入不可见的水印信息，保证图像视觉质量',
      icon: <SecurityIcon sx={{ fontSize: 40 }} />,
      path: '/invisible-watermark',
      color: '#009688',
    },
    {
      title: '提取水印',
      description: '从已添加水印的图像中提取水印信息',
      icon: <SearchIcon sx={{ fontSize: 40 }} />,
      path: '/extract-watermark',
      color: '#ff9800',
    },
    {
      title: '批量处理',
      description: '一次性为多张图像添加相同的水印',
      icon: <LayersIcon sx={{ fontSize: 40 }} />,
      path: '/batch-process',
      color: '#9c27b0',
    },
  ];

  return (
    <Box>
      {/* 顶部横幅 */}
      <Paper
        sx={{
          position: 'relative',
          backgroundColor: 'primary.main',
          color: 'white',
          mb: 4,
          p: 6,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: 4,
        }}
      >
        <Container maxWidth="md">
          <Typography
            component="h1"
            variant="h2"
            color="inherit"
            gutterBottom
            sx={{ fontWeight: 700 }}
          >
            AIGC水印标识系统
          </Typography>
          <Typography variant="h5" color="inherit" paragraph>
            符合中国工信部《人工智能生成合成内容标识办法》的水印解决方案
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            component={RouterLink}
            to="/text-watermark"
            sx={{ mt: 2 }}
          >
            开始使用
          </Button>
        </Container>
      </Paper>

      {/* 特性卡片 */}
      <Typography
        component="h2"
        variant="h4"
        align="center"
        color="textPrimary"
        gutterBottom
        sx={{ mb: 4 }}
      >
        功能特性
      </Typography>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        {features.map((feature) => (
          <Grid item key={feature.title} xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: 6,
                },
              }}
            >
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: `${feature.color}15`,
                  color: feature.color,
                }}
              >
                {feature.icon}
              </Box>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="h2">
                  {feature.title}
                </Typography>
                <Typography>{feature.description}</Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  component={RouterLink}
                  to={feature.path}
                >
                  开始使用
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 底部说明 */}
      <Paper sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <InfoIcon sx={{ color: 'primary.main', mr: 2, mt: 0.5 }} />
          <Box>
            <Typography variant="h6" gutterBottom>
              关于AIGC内容标识
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              根据中国工信部《人工智能生成合成内容标识办法》，人工智能生成的内容需要进行明确标识，
              以保障信息真实性和公众知情权。本系统提供符合规定的水印解决方案，支持显式和隐式水印，
              帮助内容创作者方便地遵守相关法规。
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default HomePage; 
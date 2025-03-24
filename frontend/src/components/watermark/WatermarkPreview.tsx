import React, { useEffect, useState } from 'react';
import { Spin, Alert, Empty, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

// 直接使用内联样式替代模块样式
const styles = {
  previewContainer: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '20px',
    width: '100%',
    marginBottom: '20px',
    flexWrap: 'wrap' as const
  },
  imageContainer: {
    flex: 1,
    minWidth: '300px',
    border: '1px solid #eee',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '10px'
  },
  imageTitle: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#f9f9f9',
    fontWeight: 'bold'
  },
  imageWrapper: {
    minHeight: '200px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '250px',
    objectFit: 'contain' as const,
    borderRadius: '4px'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px'
  }
};

interface WatermarkPreviewProps {
  originalImageUrl?: string;
  watermarkedImageUrl?: string;
  isLoading?: boolean;
  error?: string;
}

const WatermarkPreview: React.FC<WatermarkPreviewProps> = ({
  originalImageUrl,
  watermarkedImageUrl,
  isLoading = false,
  error,
}) => {
  const [originalImageLoaded, setOriginalImageLoaded] = useState(false);
  const [watermarkedImageLoaded, setWatermarkedImageLoaded] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [watermarkedError, setWatermarkedError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 当图片URL变化时重置加载状态
  useEffect(() => {
    setOriginalImageLoaded(false);
    setOriginalError(null);
  }, [originalImageUrl]);

  useEffect(() => {
    setWatermarkedImageLoaded(false);
    setWatermarkedError(null);
  }, [watermarkedImageUrl]);

  // 刷新图片函数
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setOriginalError(null);
    setWatermarkedError(null);
    setOriginalImageLoaded(false);
    setWatermarkedImageLoaded(false);
  };

  // 处理图片加载错误
  const handleOriginalError = () => {
    console.error('原始图片加载失败');
    setOriginalError('加载原始图片失败');
    setOriginalImageLoaded(false);
  };

  const handleWatermarkedError = () => {
    console.error('水印图片加载失败');
    setWatermarkedError('加载水印图片失败');
    setWatermarkedImageLoaded(false);
  };

  // 处理图片加载成功
  const handleOriginalLoad = () => {
    console.log('原始图片加载成功');
    setOriginalImageLoaded(true);
  };

  const handleWatermarkedLoad = () => {
    console.log('水印图片加载成功');
    setWatermarkedImageLoaded(true);
  };
  
  return (
    <div style={styles.previewContainer}>
      <div style={styles.imageContainer}>
        <div style={styles.imageTitle}>原始图片</div>
        <div style={styles.imageWrapper}>
          {isLoading ? (
            <Spin tip="加载原始图片..." />
          ) : originalError ? (
            <div style={styles.errorContainer}>
              <Alert 
                message={originalError} 
                type="error" 
                showIcon 
              />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                style={{ marginTop: 10 }}
              >
                重试
              </Button>
            </div>
          ) : originalImageUrl ? (
            <div style={{ position: 'relative' }}>
              {!originalImageLoaded && <Spin tip="加载中..." />}
              <img
                src={`${originalImageUrl}${originalImageUrl.includes('?') ? '&' : '?'}_v=${refreshKey}`}
                alt="原始图片"
                style={{
                  ...styles.previewImage,
                  display: originalImageLoaded ? 'block' : 'none'
                }}
                onLoad={handleOriginalLoad}
                onError={handleOriginalError}
              />
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#666', wordBreak: 'break-all' }}>
                {originalImageUrl && originalImageUrl.substring(0, 50) + (originalImageUrl.length > 50 ? '...' : '')}
              </div>
            </div>
          ) : (
            <Empty description="无原始图片" />
          )}
        </div>
      </div>

      <div style={styles.imageContainer}>
        <div style={styles.imageTitle}>水印图片</div>
        <div style={styles.imageWrapper}>
          {isLoading ? (
            <Spin tip="加载水印图片..." />
          ) : watermarkedError ? (
            <div style={styles.errorContainer}>
              <Alert 
                message={watermarkedError} 
                type="error" 
                showIcon 
              />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                style={{ marginTop: 10 }}
              >
                重试
              </Button>
            </div>
          ) : watermarkedImageUrl ? (
            <div style={{ position: 'relative' }}>
              {!watermarkedImageLoaded && <Spin tip="加载中..." />}
              <img
                src={`${watermarkedImageUrl}${watermarkedImageUrl.includes('?') ? '&' : '?'}_v=${refreshKey}`}
                alt="水印图片"
                style={{
                  ...styles.previewImage,
                  display: watermarkedImageLoaded ? 'block' : 'none'
                }}
                onLoad={handleWatermarkedLoad}
                onError={handleWatermarkedError}
              />
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#666', wordBreak: 'break-all' }}>
                {watermarkedImageUrl && watermarkedImageUrl.substring(0, 50) + (watermarkedImageUrl.length > 50 ? '...' : '')}
              </div>
            </div>
          ) : (
            <Empty description="无水印图片" />
          )}
        </div>
      </div>
    </div>
  );
};

export default WatermarkPreview; 
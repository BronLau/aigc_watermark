import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  FormControlLabel,
  Radio,
  RadioGroup,
  Button,
  InputAdornment,
  SelectChangeEvent,
} from '@mui/material';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import ImageIcon from '@mui/icons-material/Image';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import ImageUpload from './ImageUpload';

// 水印位置选项
const positionOptions = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'center', label: '中心' },
];

// 不可见水印算法选项
const invisibleWatermarkTypes = [
  { value: 'dwt', label: 'DWT (离散小波变换)' },
];

export interface WatermarkSettingsProps {
  watermarkType: string;
  onTypeChange: (type: string) => void;
  onSettingsChange: (settings: any) => void;
}

// 图像水印设置
interface ImageSettings {
  position: string;
  opacity: number;
  scale: number;
  watermarkImage: File | null;
  preview: string | null;
}

const WatermarkSettings: React.FC<WatermarkSettingsProps> = ({
  watermarkType,
  onTypeChange,
  onSettingsChange,
}) => {
  // 文本水印设置
  const [textSettings, setTextSettings] = useState({
    text: 'AI 生成',
    position: 'bottom-right',
    opacity: 0.3,
    fontSize: 36,
  });

  // 图像水印设置
  const [imageSettings, setImageSettings] = useState<ImageSettings>({
    position: 'bottom-right',
    opacity: 0.3,
    scale: 0.2,
    watermarkImage: null,
    preview: null,
  });

  // 不可见水印设置
  const [invisibleSettings, setInvisibleSettings] = useState({
    algorithm: 'dwt',
    text: 'AI 生成',
    alpha: 0.1,
  });

  // 处理文本水印设置变化
  const handleTextSettingChange = (field: string, value: any) => {
    const newSettings = { ...textSettings, [field]: value };
    setTextSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // 处理图像水印设置变化
  const handleImageSettingChange = (field: string, value: any) => {
    const newSettings = { ...imageSettings, [field]: value };
    setImageSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // 处理不可见水印设置变化
  const handleInvisibleSettingChange = (field: string, value: any) => {
    const newSettings = { ...invisibleSettings, [field]: value };
    setInvisibleSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // 水印文件上传处理
  const handleWatermarkImageUpload = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      const preview = URL.createObjectURL(file);
      const newSettings = { ...imageSettings, watermarkImage: file, preview };
      setImageSettings(newSettings);
      onSettingsChange(newSettings);
    }
  };

  return (
    <Box>
      <RadioGroup
        row
        value={watermarkType}
        onChange={(e) => onTypeChange(e.target.value)}
        sx={{ 
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          '.MuiFormControlLabel-root': { 
            mb: { xs: 1, sm: 0 },
            mr: { xs: 0, sm: 3 } 
          }
        }}
      >
        <FormControlLabel
          value="text"
          control={<Radio />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormatColorTextIcon sx={{ mr: 0.5 }} />
              <Typography>文本水印</Typography>
            </Box>
          }
        />
        <FormControlLabel
          value="image"
          control={<Radio />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ImageIcon sx={{ mr: 0.5 }} />
              <Typography>图像水印</Typography>
            </Box>
          }
        />
        <FormControlLabel
          value="invisible"
          control={<Radio />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SecurityIcon sx={{ mr: 0.5 }} />
              <Typography>隐式水印</Typography>
            </Box>
          }
        />
      </RadioGroup>

      {/* 文本水印设置 */}
      {watermarkType === 'text' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="水印文本"
              value={textSettings.text}
              onChange={(e) => handleTextSettingChange('text', e.target.value)}
              placeholder="AI 生成"
              helperText="水印文本默认为'AI 生成'，也可以输入自定义内容"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>水印位置</InputLabel>
              <Select
                value={textSettings.position}
                label="水印位置"
                onChange={(e: SelectChangeEvent) => handleTextSettingChange('position', e.target.value)}
              >
                {positionOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="字体大小"
              value={textSettings.fontSize}
              onChange={(e) => handleTextSettingChange('fontSize', parseInt(e.target.value, 10))}
              InputProps={{
                inputProps: { min: 8, max: 72 },
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography gutterBottom>不透明度: {textSettings.opacity}</Typography>
            <Slider
              value={textSettings.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(_, value) => handleTextSettingChange('opacity', value)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            />
          </Grid>
        </Grid>
      )}

      {/* 图像水印设置 */}
      {watermarkType === 'image' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
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
                    handleWatermarkImageUpload([e.target.files[0]]);
                  }
                }}
              />
              <label htmlFor="watermark-image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImageIcon />}
                  fullWidth
                >
                  选择水印图像
                </Button>
              </label>
              
              {imageSettings.watermarkImage && imageSettings.preview && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    水印图像预览
                  </Typography>
                  <img 
                    src={imageSettings.preview} 
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
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>水印位置</InputLabel>
              <Select
                value={imageSettings.position}
                label="水印位置"
                onChange={(e: SelectChangeEvent) => handleImageSettingChange('position', e.target.value)}
              >
                {positionOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>缩放比例: {Math.round(imageSettings.scale * 100)}%</Typography>
            <Slider
              value={imageSettings.scale}
              min={0.05}
              max={0.5}
              step={0.05}
              onChange={(_, value) => handleImageSettingChange('scale', value)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              marks={[
                { value: 0.05, label: '5%' },
                { value: 0.5, label: '50%' }
              ]}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography gutterBottom>不透明度: {Math.round(imageSettings.opacity * 100)}%</Typography>
            <Slider
              value={imageSettings.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(_, value) => handleImageSettingChange('opacity', value)}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              marks={[
                { value: 0, label: '0%' },
                { value: 1, label: '100%' }
              ]}
            />
          </Grid>
        </Grid>
      )}

      {/* 隐式水印设置 */}
      {watermarkType === 'invisible' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              隐式水印将在视觉上不可见，但可以通过特定技术进行检测和提取。请在页面下方设置详细参数。
            </Typography>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default WatermarkSettings; 
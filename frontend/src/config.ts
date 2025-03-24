/**
 * 应用全局配置
 */

// API服务器URL
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// 默认水印设置
export const DEFAULT_WATERMARK_TEXT = 'AI生成';
export const DEFAULT_WATERMARK_POSITION = 'bottom-right';
export const DEFAULT_WATERMARK_OPACITY = 0.7;
export const DEFAULT_WATERMARK_SCALE = 0.2;

// 水印位置选项
export const WATERMARK_POSITIONS = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-center', label: '上方居中' },
  { value: 'top-right', label: '右上角' },
  { value: 'middle-left', label: '左侧居中' },
  { value: 'middle-center', label: '正中央' },
  { value: 'middle-right', label: '右侧居中' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-center', label: '下方居中' },
  { value: 'bottom-right', label: '右下角' },
];

// 隐式水印算法
export const INVISIBLE_WATERMARK_ALGORITHMS = [
  { value: 'dwt', label: 'DWT (离散小波变换)', description: '一种基于小波变换的水印技术，通过修改图像小波域的系数来嵌入水印，具有良好的鲁棒性和隐蔽性。' },
]; 
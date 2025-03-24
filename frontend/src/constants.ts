// API 相关常量
// 使用当前网页的主机名和端口来构建API URL
// 确保API_URL是正确的
export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000' 
  : window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : `http://${window.location.hostname}:8000`;

// 其他应用相关常量
export const APP_NAME = 'AIGC Watermark';
export const APP_VERSION = '0.1.0';

// 文件相关常量
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; 
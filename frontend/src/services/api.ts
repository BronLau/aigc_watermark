import axios from 'axios';
import { API_URL } from '../constants';

// 创建API客户端实例
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 增加超时时间为60秒
});

// 请求拦截器 - 添加认证令牌
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401错误时，不要跳转到登录页面，只记录错误
    if (error.response && error.response.status === 401) {
      console.error('认证失败:', error);
      // 不再自动重定向到登录页
      // localStorage.removeItem('token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 修复API基础URL格式
const apiBaseUrl = API_URL.endsWith('/') ? API_URL : `${API_URL}/api/watermark`;

// 登录
export const login = async (username: string, password: string) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  
  const response = await axios.post(`${API_URL}/api/auth/login`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  return response.data;
};

// 注册
export const register = async (username: string, password: string, email: string) => {
  const response = await apiClient.post('/api/auth/register', {
    username,
    password,
    email,
  });
  
  return response.data;
};

// 用户信息
export const getUserInfo = async () => {
  const response = await apiClient.get('/api/users/me');
  return response.data;
};

// 定义水印算法类型
export type AlgorithmTypes = 'dct' | 'dft' | 'dwt' | 'bpcs';

// 添加隐式水印
export const addInvisibleWatermark = async (
  file: File,
  wm_text: string,
  wmImage: File | null = null,
  alpha: number = 0.1,
  algorithm: AlgorithmTypes = 'dwt'
): Promise<{ success: boolean; message: string; url: string }> => {
  const formData = new FormData();
  formData.append('image_file', file);
  formData.append('watermark_text', wm_text);
  if (wmImage) {
    formData.append('watermark_image', wmImage);
  }
  formData.append('alpha', String(alpha));
  formData.append('algorithm', algorithm);

  try {
    const apiUrl = `${API_URL}/api/watermark/add_invisible_watermark`;
    console.log('请求的完整URL:', apiUrl);
    console.log('表单数据:', {
      'image_file': file.name,
      'watermark_text': wm_text,
      'watermark_image': wmImage?.name || 'none',
      'alpha': alpha,
      'algorithm': algorithm
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('请求失败');
    }

    const data = await response.json();
    console.log('隐形水印添加结果:', data);

    // 检查返回的图像URL，按优先级选择
    let imageUrl = '';
    if (data.image_url) {
      console.log('使用 image_url:', data.image_url);
      imageUrl = data.image_url;
    } else if (data.result_url) {
      console.log('使用 result_url:', data.result_url);
      imageUrl = data.result_url;
    } else if (data.url) {
      console.log('使用 url:', data.url);
      imageUrl = data.url;
    } else {
      console.error('没有找到有效的图像URL', data);
      return { success: false, message: '未返回有效的图像URL', url: '' };
    }

    // 确保URL是完整的
    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('blob:')) {
      // 如果是相对路径，拼接完整URL
      if (!imageUrl.startsWith('/')) {
        imageUrl = `/${imageUrl}`;
      }
      imageUrl = `${API_URL}${imageUrl}`;
      console.log('拼接完整URL:', imageUrl);
    }

    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    imageUrl = imageUrl.includes('?') 
      ? `${imageUrl}&t=${timestamp}` 
      : `${imageUrl}?t=${timestamp}`;

    return {
      success: true,
      message: data.message || '水印添加成功',
      url: imageUrl,
    };
  } catch (error) {
    console.error('添加隐形水印失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知错误',
      url: '',
    };
  }
};

// 添加文本水印
export const addTextWatermark = async (
  formData: FormData
) => {
  try {
    const url = `${apiBaseUrl}/text`;
    console.log('准备发送文本水印请求', {
      url: url,
      formData: Array.from(formData.entries()).map(([key, value]) => {
        if (value instanceof File) {
          return [key, `File(${value.name}, ${value.size})`];
        }
        return [key, value];
      })
    });
    
    const response = await axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // 记录原始响应数据
    console.log('添加文本水印响应数据:', JSON.stringify(response.data));
    
    // 创建统一的返回格式
    const resultData = {
      success: response.data.success || false,
      message: response.data.message || '',
      result_url: '',
      image_url: ''
    };

    // 优先使用result_url，其次使用image_url
    if (response.data.result_url) {
      console.log('从后端获取到result_url字段:', response.data.result_url);
      resultData.result_url = response.data.result_url;
      resultData.image_url = response.data.result_url; // 同时设置image_url
    } else if (response.data.image_url) {
      console.log('从后端获取到image_url字段:', response.data.image_url);
      resultData.image_url = response.data.image_url;
      resultData.result_url = response.data.image_url; // 同时设置result_url
    } else {
      console.error('后端响应中没有有效的图片URL字段');
      return {
        success: false,
        message: '后端未返回有效图片URL',
        result_url: '',
        image_url: ''
      };
    }
    
    // 确保URL是完整的
    if (!resultData.result_url.startsWith('http') && !resultData.result_url.startsWith('blob:')) {
      const timestamp = Date.now();
      const fullUrl = `${API_URL}${resultData.result_url}?_t=${timestamp}`;
      console.log('构建完整URL:', fullUrl);
      resultData.result_url = fullUrl;
      resultData.image_url = fullUrl;
    }
    
    // 尝试预加载图片并创建blob URL
    try {
      console.log('开始预加载图片:', resultData.result_url);
      const imageResponse = await fetch(resultData.result_url);
      console.log('图片加载响应:', imageResponse.status, imageResponse.statusText);
      
      if (!imageResponse.ok) {
        console.error('图片加载失败:', imageResponse.status, imageResponse.statusText);
        throw new Error(`图片加载失败: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      const blob = await imageResponse.blob();
      console.log('获取到图片blob:', blob.size, 'bytes', blob.type);
      
      const blobUrl = URL.createObjectURL(blob);
      console.log('创建Blob URL成功:', blobUrl);
      
      resultData.result_url = blobUrl;
      resultData.image_url = blobUrl;
    } catch (err) {
      console.error('图片预加载失败:', err);
      // 继续使用原始URL
    }
    
    console.log('处理后的返回数据:', resultData);
    return resultData;
  } catch (error) {
    console.error('添加文本水印API错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '添加文本水印时发生未知错误',
      result_url: '',
      image_url: ''
    };
  }
};

// 添加图像水印
export const addImageWatermark = async (
  formData: FormData
) => {
  try {
    const response = await axios.post(`${apiBaseUrl}/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // 记录原始响应数据便于调试
    console.log('图片水印API响应数据:', response.data);

    const data = response.data;
    
    // 检查图片URL并确保它是完整的
    if (data.image_url && !data.image_url.startsWith('http')) {
      data.image_url = `${apiBaseUrl}${data.image_url}`;
    }
    
    // 检查结果URL并确保它是完整的
    if (data.result_url && !data.result_url.startsWith('http')) {
      data.result_url = `${apiBaseUrl}${data.result_url}`;
      
      // 预加载结果图片
      try {
        const imgResponse = await fetch(data.result_url);
        if (!imgResponse.ok) {
          throw new Error(`无法加载图片: ${imgResponse.status}`);
        }
        const blob = await imgResponse.blob();
        data.result_url = URL.createObjectURL(blob);
      } catch (error) {
        console.error('预加载图片失败:', error);
        // 继续使用原始URL
      }
    }

    return data;
  } catch (error) {
    console.error('添加图片水印失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '添加图片水印时发生未知错误',
    };
  }
};

// 提取隐式水印
export const extractInvisibleWatermark = async (formData: FormData, algorithm: string = 'dwt') => {
  try {
    // 确保formData中的图像参数名称为'image'，而不是'image_file'
    // 创建新的FormData以确保正确的参数名称
    const apiFormData = new FormData();
    
    // 获取原始的image_file并以正确的名称添加到新FormData
    const imageFile = formData.get('image_file');
    if (imageFile) {
      apiFormData.append('image', imageFile);
    } else {
      // 尝试以另一个可能的名称获取图片文件
      const image = formData.get('image');
      if (image) {
        apiFormData.append('image', image);
      } else {
        throw new Error('表单中未找到图像文件');
      }
    }
    
    // 添加其他可能存在的参数
    // 使用Array.from转换FormData entries以解决TypeScript迭代错误
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (key !== 'image_file' && key !== 'image') {
        apiFormData.append(key, value);
      }
    });
    
    console.log('提取水印请求参数:', {
      url: `${API_URL}/api/watermark/extract_invisible_watermark`,
      algorithm,
      formData: '包含图像文件'
    });
    
    const response = await axios.post(
      `${API_URL}/api/watermark/extract_invisible_watermark`,
      apiFormData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: {
          algorithm
        }
      }
    );
    
    // 处理返回的数据，确保水印图像URL能够正确预览
    const data = response.data;
    console.log('提取水印原始响应:', data);
    
    // 检查并处理水印图像URL
    if (data.success && data.detected) {
      console.log('检测到水印类型:', data.watermark_type);
      
      // 处理图像水印URL
      if (data.watermark_type === 'image' && data.watermark_image_url) {
        console.log('处理前的图像水印URL:', data.watermark_image_url);
        
        // 确保URL是完整的，并添加时间戳防止缓存问题
        if (data.watermark_image_url.startsWith('/')) {
          const timestamp = Date.now();
          data.watermark_image_url = `${API_URL}${data.watermark_image_url}?t=${timestamp}`;
          console.log('处理后的图像水印URL:', data.watermark_image_url);
        }
        
        // 尝试预加载图像
        try {
          console.log('尝试预加载水印图像');
          const testImage = new Image();
          testImage.src = data.watermark_image_url;
          
          // 添加加载事件监听
          testImage.onload = () => {
            console.log('水印图像预加载成功');
          };
          
          testImage.onerror = (err) => {
            console.error('水印图像加载失败:', err);
            // 重试一次，可能是缓存问题
            const retryTimestamp = Date.now();
            const retryUrl = `${API_URL}${data.watermark_image_url.split('?')[0]}?t=${retryTimestamp}`;
            console.log('尝试使用新URL重新加载:', retryUrl);
            data.watermark_image_url = retryUrl;
            
            const retryImage = new Image();
            retryImage.src = retryUrl;
          };
        } catch (err) {
          console.error('预加载水印图像时出错:', err);
        }
      }
      // 检查是否为空文本水印，这可能是需要提取图像水印的情况
      else if (data.watermark_type === 'text' && !data.watermark_text) {
        console.log('检测到空文本水印，可能需要提取图像水印');
        
        // 这里我们不直接修改返回数据，让前端页面处理这种情况
        data.may_contain_image_watermark = true;
      }
    }
    
    return data;
  } catch (error) {
    console.error('提取隐式水印时发生错误:', error);
    
    // 返回标准错误响应格式
    return { 
      success: false, 
      message: error instanceof Error ? `水印提取失败: ${error.message}` : '水印提取失败', 
      detected: false 
    };
  }
};

// 自动检测水印
export const autoDetectWatermark = async (formData: FormData) => {
  try {
    // 直接调用提取水印的API
    return await extractInvisibleWatermark(formData);
  } catch (error) {
    console.error('自动检测水印失败:', error);
    throw error;
  }
};

// 获取历史记录
export const getWatermarkHistory = async () => {
  const response = await apiClient.get('/users/watermarks');
  return response.data;
};

// 身份验证相关API
export const authAPI = {
  // 登录
  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await apiClient.post('/api/auth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // 保存token到localStorage
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    
    return response.data;
  },
  
  // 注册
  register: async (userData: any) => {
    return await apiClient.post('/api/auth/register', userData);
  },
  
  // 检查是否已登录
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  
  // 登出
  logout: () => {
    localStorage.removeItem('token');
  }
};

// 水印相关API函数 - 直接导出以解决导入问题
// 添加文本水印
export const addTextWatermarkAPI = async (
  image: File,
  text: string,
  position: string,
  opacity: number,
  fontSize: number
) => {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('text', text);
  formData.append('position', position);
  formData.append('opacity', opacity.toString());
  formData.append('font_size', fontSize.toString());
  
  const response = await apiClient.post('/api/watermark/text', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};

// 添加图像水印
export const addImageWatermarkAPI = async (
  image: File,
  watermarkImage: File,
  position: string,
  opacity: number,
  scale: number
) => {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('watermark_image', watermarkImage);
  formData.append('position', position);
  formData.append('opacity', opacity.toString());
  formData.append('scale', scale.toString());
  
  console.log('API formData:', {
    image: image.name,
    watermarkImage: watermarkImage.name,
    position,
    opacity,
    scale
  });
  
  const response = await apiClient.post('/api/watermark/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  console.log('API响应:', response.data);
  
  return response.data;
};

// DCT水印API (为了保持向后兼容，实际使用DWT算法)
export const addDctWatermarkAPI = async (
  image: File,
  text: string,
  alpha: number = 0.1
) => {
  console.log('使用DWT算法替代DCT算法');
  return addDwtWatermarkAPI(image, text, alpha);
};

// DWT水印API
export const addDwtWatermarkAPI = async (
  image: File,
  text: string,
  alpha: number = 0.1
) => {
  console.log('使用DWT算法添加水印');
  const formData = new FormData();
  formData.append('image_file', image);
  formData.append('watermark_text', text);
  formData.append('alpha', String(alpha));
  formData.append('algorithm', 'dwt');
  return addInvisibleWatermark(image, text, null, alpha, 'dwt');
};

// LSB水印API (为了保持向后兼容，实际使用DWT算法)
export const addLsbWatermarkAPI = async (
  image: File,
  text: string
) => {
  console.log('使用DWT算法替代LSB算法');
  return addDwtWatermarkAPI(image, text, 0.1);
};

// 提取水印
export const extractWatermarkAPI = async (
  image: File,
  watermarkType: string
) => {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('watermark_type', 'dwt'); // 始终使用DWT算法
  
  const response = await apiClient.post('/api/watermark/extract-watermark', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  // 确保图片URL是完整的
  if (response.data && response.data.image_url && !response.data.image_url.startsWith('http')) {
    response.data.image_url = `${API_URL}${response.data.image_url}`;
  }
  
  return response.data;
};

// 批量处理
export const batchProcessAPI = async (
  images: File[],
  watermarkType: string,
  text?: string,
  position?: string,
  opacity?: number,
  alpha?: number
) => {
  const formData = new FormData();
  
  // 添加多个图片文件
  images.forEach(image => {
    formData.append('images', image);
  });
  
  formData.append('watermark_type', watermarkType);
  
  if (text) formData.append('text', text);
  if (position) formData.append('position', position);
  if (opacity !== undefined) formData.append('opacity', opacity.toString());
  if (alpha !== undefined) formData.append('alpha', alpha.toString());
  
  try {
    console.log('批量处理请求参数:', {
      watermarkType,
      text,
      position,
      opacity,
      alpha,
      imageCount: images.length
    });
    
    const response = await apiClient.post('/api/watermark/batch-process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('批量处理原始响应:', response.data);
    
    // 处理响应中的URL，确保URL是完整的
    if (response.data && response.data.success) {
      // 检查数据结构
      if (response.data.data && Array.isArray(response.data.data)) {
        // 处理每个结果项中的URL
        response.data.data = response.data.data.map((item: any) => {
          if (item && item.url && !item.url.startsWith('http')) {
            // 如果URL是相对路径，补全为绝对URL
            const fullUrl = `${API_URL}${item.url}`;
            console.log(`转换URL: ${item.url} -> ${fullUrl}`);
            return { ...item, url: fullUrl };
          }
          return item;
        });
      } else if (response.data.data && response.data.data.results && Array.isArray(response.data.data.results)) {
        // 处理data.results中的URL
        response.data.data.results = response.data.data.results.map((item: any) => {
          if (item && item.url && !item.url.startsWith('http')) {
            // 如果URL是相对路径，补全为绝对URL
            const fullUrl = `${API_URL}${item.url}`;
            console.log(`转换URL: ${item.url} -> ${fullUrl}`);
            return { ...item, url: fullUrl };
          }
          return item;
        });
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('批量处理API错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '批量处理时发生未知错误',
      data: []
    };
  }
};

// 水印相关API - 保持对象方式导出
export const watermarkAPI = {
  addTextWatermark: addTextWatermarkAPI,
  addImageWatermark: addImageWatermarkAPI,
  addDctWatermark: addDctWatermarkAPI,
  addDwtWatermark: addDwtWatermarkAPI,
  addLsbWatermark: addLsbWatermarkAPI,
  extractWatermark: extractWatermarkAPI,
  batchProcess: batchProcessAPI
};

// 水印记录相关API
export const recordsAPI = {
  // 获取水印记录列表
  getRecords: async (params: any = {}) => {
    return await apiClient.get('/api/records', { params });
  },
  
  // 获取单个水印记录
  getRecord: async (id: number) => {
    return await apiClient.get(`/api/records/${id}`);
  },
  
  // 获取水印统计
  getStatistics: async () => {
    return await apiClient.get('/api/records/statistics');
  },
  
  // 更新水印记录
  updateRecord: async (id: number, data: any) => {
    return await apiClient.put(`/api/records/${id}`, data);
  },
  
  // 删除水印记录
  deleteRecord: async (id: number) => {
    return await apiClient.delete(`/api/records/${id}`);
  }
};

// 创建一个命名的API集合对象
const apiService = {
  auth: authAPI,
  watermark: watermarkAPI,
  records: recordsAPI
};

export default apiService; 
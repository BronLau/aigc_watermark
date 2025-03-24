/**
 * 封装的fetch函数，自动处理凭证和常见错误
 * 
 * @param url 请求URL
 * @param options 请求选项
 * @param retries 重试次数
 * @param timeout 超时时间（毫秒）
 * @returns Promise with fetch response
 */
export const fetchWithCredentials = async (
  url: string, 
  options: RequestInit = {},
  retries: number = 2,
  timeout: number = 120000 // 延长超时时间至120秒
): Promise<Response> => {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(options.body instanceof FormData ? {} : {'Content-Type': 'application/json'}),
      ...options.headers,
    },
    mode: 'cors', // 明确指定CORS模式
  };

  // 移除undefined的header项
  const headers: Record<string, string> = { ...defaultOptions.headers as Record<string, string> };
  Object.keys(headers).forEach(key => {
    if (headers[key] === undefined) {
      delete headers[key];
    }
  });
  defaultOptions.headers = headers;

  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // 增加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    if (!mergedOptions.signal) {
      mergedOptions.signal = controller.signal;
    }
    
    // 打印请求信息用于调试
    console.log(`Sending request to: ${url}`);
    console.log('Request options:', {
      method: mergedOptions.method,
      headers: mergedOptions.headers,
      credentials: mergedOptions.credentials,
      mode: mergedOptions.mode,
      timeout: timeout
    });
    
    const response = await fetch(url, mergedOptions);
    
    // 清除超时定时器
    clearTimeout(timeoutId);
    
    // 打印响应信息用于调试
    console.log(`Response from ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers)
    });
    
    if (response.status === 401) {
      // 处理未授权错误
      console.error('Authentication error');
      // 可以在这里添加重定向到登录页面等逻辑
    }
    
    // 检查是否有网络错误或服务器错误
    if (!response.ok && response.status >= 500) {
      console.error(`Server error: ${response.status} ${response.statusText}`);
      
      // 如果还有重试次数，则重试
      if (retries > 0) {
        console.log(`Retrying request to ${url}, ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 增加延迟时间到2秒
        return fetchWithCredentials(url, options, retries - 1, timeout);
      }
    }
    
    return response;
  } catch (error: any) {
    // 处理不同类型的错误
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error: The server may be offline or unreachable');
      console.error('Detailed error:', error);
    } else if (error.name === 'AbortError') {
      console.error('Request timeout: The server did not respond in time');
      console.error('Timeout setting:', timeout, 'ms');
    } else {
      console.error('Network error:', error);
    }
    
    // 如果还有重试次数且是网络错误，则重试
    if (retries > 0 && (error instanceof TypeError || error.name === 'AbortError')) {
      console.log(`Retrying request to ${url}, ${retries} attempts left`);
      // 增加延迟时间
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒后重试
      return fetchWithCredentials(url, options, retries - 1, timeout);
    }
    
    throw error;
  }
}; 
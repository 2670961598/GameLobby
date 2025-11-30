/**
 * API configuration and utilities
 */

const isDev = import.meta.env.DEV

/**
 * Make an API request with proper base URL handling
 */
export const apiRequest = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  // 在开发模式下，Vite会自动代理以/api开头的请求
  // 在生产模式下，直接请求后端服务器
  let url: string
  
  // 开发和生产模式都使用相对路径
  // 在开发模式下，Vite会自动代理以/api开头的请求
  // 在生产模式下，Vue应用和Flask服务器在同一域名下，使用相对路径即可
  if (endpoint.startsWith('/')) {
    url = endpoint
  } else {
    url = `/${endpoint}`
  }
  
  // 添加调试日志
  console.log(`API请求 [${isDev ? '开发' : '生产'}]:`, {
    原始endpoint: endpoint,
    最终URL: url,
    模式: isDev ? 'dev' : 'prod'
  })
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 合并用户提供的headers
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        defaultHeaders[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        defaultHeaders[key] = value
      })
    } else {
      Object.assign(defaultHeaders, options.headers)
    }
  }

  // 如果是FormData，移除Content-Type头让浏览器自动设置
  if (options?.body instanceof FormData) {
    delete defaultHeaders['Content-Type']
    console.log('检测到FormData，移除Content-Type头')
  }

  const defaultOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
  }

  try {
    console.log('发起请求:', url, defaultOptions)
    const response = await fetch(url, defaultOptions)
    console.log('请求响应:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })
    return response
  } catch (error) {
    console.error('API request failed:', {
      url,
      error: error instanceof Error ? error.message : String(error),
      options: defaultOptions
    })
    throw error
  }
}

/**
 * GET request helper
 */
export const get = (endpoint: string, options?: RequestInit) => {
  return apiRequest(endpoint, { ...options, method: 'GET' })
}

/**
 * POST request helper
 */
export const post = (endpoint: string, data?: any, options?: RequestInit) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  })
}

/**
 * PUT request helper
 */
export const put = (endpoint: string, data?: any, options?: RequestInit) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'PUT',
    body: data instanceof FormData ? data : JSON.stringify(data),
  })
}

/**
 * DELETE request helper
 */
export const del = (endpoint: string, options?: RequestInit) => {
  return apiRequest(endpoint, { ...options, method: 'DELETE' })
} 
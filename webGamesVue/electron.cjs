const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

// Keep a global reference of the window object
let mainWindow

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false // 在生产模式下关闭web安全性以允许跨域请求
    },
    icon: path.join(__dirname, 'assets/icon.png'), // 可以添加应用图标
    show: false // 等待ready-to-show事件再显示
  })

  // Load the app
  if (isDev) {
    // 开发模式：加载Vite开发服务器，Vite会自动代理API请求到172.18.67.143:11452
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载本地打包文件
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
    
    // 在生产环境中拦截API请求并重定向到远程服务器
    const { session } = require('electron')
    
    // 拦截所有可能的API请求URL模式，包括file://协议和静态资源
    session.defaultSession.webRequest.onBeforeRequest({
      urls: [
        'file://*/api/*', 
        'file://*/game/*', 
        'file://*/games/*',
        'file://*/upload-*',
        'file://*/scores*',
        'file://*/leaderboard/*',
        'file://*/uploads/*',
        'file://*/static/*',
        'file://*/assets/*',
        'file://*/images/*',
        'http://localhost/api/*',
        'http://localhost/game/*', 
        'http://localhost/games/*',
        'http://localhost/upload-*',
        'http://localhost/scores*',
        'http://localhost/leaderboard/*',
        'http://localhost/uploads/*',
        'http://localhost/static/*',
        'http://localhost/assets/*',
        'http://localhost/images/*',
        '*://*/api/*', 
        '*://*/game/*', 
        '*://*/games/*',
        '*://*/upload-*',
        '*://*/scores*',
        '*://*/leaderboard/*',
        '*://*/uploads/*',
        '*://*/static/*',
        '*://*/assets/*',
        '*://*/images/*'
      ]
    }, (details, callback) => {
      try {
        const url = new URL(details.url)
        console.log('API请求拦截 - 原始URL:', details.url)
        console.log('URL对象:', {
          protocol: url.protocol,
          hostname: url.hostname,
          pathname: url.pathname,
          search: url.search
        })
        
        // 如果请求已经指向目标服务器，就不再重定向，避免无限循环
        if (url.hostname === '172.18.67.143' && url.port === '11452') {
          console.log('请求已指向目标服务器，跳过重定向')
          callback({})
          return
        }
        
        // 将请求重定向到远程服务器
        const redirectURL = `http://172.18.67.143:11452${url.pathname}${url.search}`
        console.log('API请求重定向:', details.url, '→', redirectURL)
        callback({ redirectURL })
      } catch (error) {
        console.error('URL解析失败:', details.url, error)
        callback({})
      }
    })
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow()

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    require('electron').shell.openExternal(navigationUrl)
  })
})

// Prevent navigation to external websites (但允许访问远程API服务器)
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    // 允许开发服务器和远程API服务器
    const allowedOrigins = [
      'http://localhost:5173',
      'http://172.18.67.143:11452'
    ]
    
    if (!allowedOrigins.includes(parsedUrl.origin) && !isDev) {
      event.preventDefault()
    }
  })
}) 
const { app, BrowserWindow, globalShortcut, screen, Tray, Menu, shell, ipcMain: ipcRenderer, nativeImage } = require('electron')
const path = require('path')
const isDev = require('electron-is-dev')
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const PORT = 3000
const appDir = path.resolve(__dirname, '..')

function handleAuthRedirect(authWindow, url) {
    if (url.includes('localhost:3000') && !url.includes('/api/google/auth')) {
       // We are back at the app! Auth probably successful or failed back to home.
       // Let the cookie set happen, then close.
       // Wait a bit for the page to actually process the cookie? 
       // Actually 'will-navigate' checks before loading. We should let it load.
       
       // Using 'did-navigate' might be better or just let it load then close?
       // Let's close it after a short delay to ensure cookies are written?
       // Or even better, let it load the page, and if the page is the homepage ('/'), close.
       
       // For now, let's allow the navigation, but hook into 'did-navigate'
    }
}

// Initialize Next.js app if in production
let nextApp
let handle

if (!isDev) {
  // In production, we run the Next.js server inside Electron
  const nextConf = require('../next.config.js')
  nextApp = next({ dev: false, dir: appDir, conf: nextConf })
  handle = nextApp.getRequestHandler()
}

let mainWindow
let tray

async function startServer() {
  if (!isDev) {
    try {
      await nextApp.prepare()
      createServer((req, res) => {
        const parsedUrl = parse(req.url, true)
        handle(req, res, parsedUrl)
      }).listen(PORT, (err) => {
        if (err) throw err
        console.log(`> Ready on http://localhost:${PORT}`)
      })
    } catch (err) {
      console.error('Could not start Next.js server:', err)
    }
  }
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  
  // Initial size: Start as just a bar (Raycast style)
  const windowWidth = 750
  const windowHeight = 80 // Height for just the input bar
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - 600) / 3), // Position based on max height so it doesn't jump
    show: false,
    frame: false, 
    transparent: true,
    resizable: false, // We'll resize programmatically
    fullscreenable: false,
    skipTaskbar: true, 
    hasShadow: true,
    alwaysOnTop: true, // Keep it visible like a spotlight tool
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    vibrancy: 'popover', // 'popover' or 'hud' often looks better for small floating windows
    visualEffectState: 'active',
  })

  // Show on all workspaces (Mission Control spaces)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) 

  // Open external links in default browser instead of the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Handle Google Auth flow in a separate, normal window
    if (url.includes('accounts.google.com') || url.includes('/api/google/auth')) {
        const authWindow = new BrowserWindow({
            width: 600,
            height: 700,
            show: true,
            frame: true, 
            autoHideMenuBar: true,
            parent: mainWindow, 
            modal: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            }
        })
        
        authWindow.webContents.on('did-navigate', (event, newUrl) => {
             // If we are back at root, we are done
             try {
                const u = new URL(newUrl)
                if (u.pathname === '/' && !u.searchParams.has('code')) {
                    authWindow.close()
                    mainWindow.reload() // Refresh main window to pick up new state
                }
             } catch (e) {
                // ignore invalid urls
             }
        })
        
        // Handle the auth flow
        authWindow.loadURL(url)
        
        // Check when we get redirected back to our app
        authWindow.webContents.on('will-redirect', (event, newUrl) => {
             // If we are coming back to calling localhost with a code?
             if (newUrl.includes('localhost') && newUrl.includes('code=')) {
                 // allow it to process
             }
        })

        return { action: 'deny' }
    }

    shell.openExternal(url)
    return { action: 'deny' }
  })


  const startUrl = `http://localhost:${PORT}`
  mainWindow.loadURL(startUrl)

  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    // In dev, we might start before localhost:3000 is ready, so this might be white initially
    // but typically we wait-on in the script.
    // In prod, startServer() is awaited before creating window? No, done in parallel or sequence.
  })

  // Hide on blur (Raycast behavior)
  mainWindow.on('blur', () => {
    if (!isDev) {
        // Reset to bar size on hide? Optional, but feels cleaner
        // mainWindow.setSize(750, 80) 
        mainWindow.hide()
    }
  })

  ipcRenderer.on('resize-window', (event, { width, height }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const { width: currentWidth, height: currentHeight } = mainWindow.getBounds();
        // Only center if the size is actually changing significantly (e.g. going from bar to chat)
        // If it's a small change, it might just be the content growing.
        // But for "bar" -> "chat" it's a big jump.
        
        mainWindow.setSize(width, height, true) // true = animate
        
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
        // We always want to recenter horizontally
        // Vertically, we prefer the "top third" position like Spotlight/Raycast
        mainWindow.setPosition(
            Math.floor((screenWidth - width) / 2),
            Math.floor((screenHeight - 600) / 3), // Keep consistent vertical anchor
            true // animate
        )
    }
  })

  ipcRenderer.on('hide-window', () => {
    mainWindow.hide()
  })

  ipcRenderer.on('manage-app', (event, { appName, action }) => {
    const { exec } = require('child_process');
    const sanitizedAppName = appName.replace(/"/g, '\\"');
    console.log(`Manage App: ${action} ${sanitizedAppName}`);
    
    let command = '';
    
    switch (action) {
        case 'launch':
        case 'focus': // 'open -a' also focuses/activates if already running
            command = `open -a "${sanitizedAppName}"`;
            break;
        case 'quit':
            // Try multiple methods for robustness
            // 1. AppleScript Quit (Graceful)
            command = `osascript -e 'quit app "${sanitizedAppName}"'`;
            break;
        case 'minimize':
            // Use system events to set visible to false. 
            // Requires the exact process name. 
            // If "Messages" fails, it might be due to "Messages" vs "MobileSMS" (historically) or similar,
            // but usually it works if permissions are granted.
            // We can also try Cmd+H (Hide) injection if frontmost? No, unsafe.
            // Try a more robust AppleScript that ignores errors
            command = `osascript -e 'try
                tell application "System Events"
                    set visible of process "${sanitizedAppName}" to false
                end tell
            on error
                -- Fallback: try to find process containing name
                tell application "System Events"
                    set proc to first process whose name contains "${sanitizedAppName}"
                    set visible of proc to false
                end tell
            end try'`;
            break;
    }

    if (command) {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                // For quit, if standard quit fails, we could try kill?
                // But that is dangerous. 
            }
        });
    }
  })

  ipcRenderer.handle('get-running-apps', async () => {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
          // Use 'application process' instead of 'process' for better filtering and stability
          // Also wrap in try/catch to handle permission issues gracefully
          const script = `
            try
                tell application "System Events"
                    get name of every application process whose background only is false
                end tell
            on error
                return ""
            end try
          `;
          
          exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
              if (error) {
                  // Only log if it's not the common permission error (which user might ignore)
                  if (!stderr.includes('(-1719)')) {
                       console.error('Failed to get running apps:', error.message);
                  }
                  resolve([]);
                  return;
              }
              if (!stdout.trim()) {
                  resolve([]);
                  return;
              }
              // AppleScript returns comma separated list: "App1, App2, App3"
              const apps = stdout.trim().split(', ').map(s => s.trim());
              resolve(apps);
          });
      });
  })
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    // Recenter every time in case checking different monitor
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const [winWidth, winHeight] = mainWindow.getSize()
    mainWindow.setPosition(
        Math.floor((screenWidth - winWidth) / 2),
        Math.floor((screenHeight - winHeight) / 3)
    )
    mainWindow.show()
    mainWindow.focus()
  }
}

app.whenReady().then(async () => {
  await startServer()
  createWindow()

  // Register Global Shortcut
  const ret = globalShortcut.register('Option+Space', () => {
    toggleWindow()
  })

  if (!ret) {
    console.log('Registration failed')
  }

  // Create Tray Icon
  // Using an empty image effectively creates a text-only tray item on macOS which is common for utilities
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setTitle(' Dotion') 
  tray.setIgnoreDoubleClickEvents(true)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: toggleWindow },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
  
  tray.setToolTip('Dotion')
  // On macOS, left click opens context menu by default if no click handler, 
  // but we might want click to toggle window? 
  // Standard macOS menu bar apps usually open a menu or a popover. 
  // User asked for "top taskbar", implying access.
  // Let's keep the context menu for Quit, but maybe 'click' toggles window too?
  // Usually right click is context menu.
  tray.setContextMenu(contextMenu)
  
  if (process.platform === 'darwin') {
      // Hide from Dock ("bottom app bar")
      app.dock.hide()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Overwrite default behavior to NOT quit (keep running in bg)
  // unless explicitly quit.
})

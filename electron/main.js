const { app, BrowserWindow, Menu, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const isDev = process.env.NODE_ENV === 'development';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 400,
        minHeight: 600,
        title: 'CET-6 词汇学习 (E-Ink版)',
        backgroundColor: '#F5F1E8',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false
        },
        autoHideMenuBar: true,
        show: false
    });

    let indexPath = path.join(__dirname, '..', 'index.html');
    if (!fs.existsSync(indexPath)) {
        indexPath = path.join(__dirname, 'index.html');
    }
    mainWindow.loadFile(indexPath);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    const template = [
        {
            label: '文件',
            submenu: [
                { label: '导出错词本', click: () => mainWindow.webContents.executeJavaScript('exportErrors()') },
                { label: '导出学习数据', click: () => mainWindow.webContents.executeJavaScript('exportData()') },
                { type: 'separator' },
                { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '放大', role: 'zoomIn' },
                { label: '缩小', role: 'zoomOut' },
                { label: '重置缩放', role: 'resetZoom' },
                { type: 'separator' },
                { label: '全屏', role: 'togglefullscreen' }
            ]
        },
        {
            label: '学习',
            submenu: [
                { label: '发音', accelerator: 'Ctrl+S', click: () => mainWindow.webContents.executeJavaScript('speakWord()') },
                { label: '显示释义', accelerator: 'Ctrl+D', click: () => mainWindow.webContents.executeJavaScript('toggleWord()') },
                { type: 'separator' },
                { label: '上一个', accelerator: 'Left', click: () => mainWindow.webContents.executeJavaScript('prevWord()') },
                { label: '下一个', accelerator: 'Right', click: () => mainWindow.webContents.executeJavaScript('nextWord()') }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: '关于 CET-6 词汇学习 (E-Ink版)',
                            message: 'CET-6 英语六级词汇背诵系统 v1.0.0',
                            detail: '墨水屏优化版，适合电子阅读器及护眼场景。\n支持单词背诵、默写、回忆训练、错词管理。'
                        });
                    }
                }
            ]
        }
    ];

    if (isDev) {
        template.push({
            label: '开发',
            submenu: [
                { label: '开发者工具', role: 'toggleDevTools' },
                { label: '重新加载', role: 'reload' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

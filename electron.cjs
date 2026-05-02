const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { Client: SCPClient } = require('node-scp');
const { Client: SSHClient } = require('ssh2');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Real SSH Deploy Manager",
    icon: path.join(__dirname, 'assets', 'terminal.png'), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#050505',
  });

  // Remove o menu padrão (File, Edit, etc)
  mainWindow.setMenu(null);

  // Em produção, carregamos o arquivo estático gerado pelo build do Vite
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Remove o menu padrão (opcional)
  // mainWindow.setMenu(null);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// --- BANCO DE DADOS LOCAL (JSON) ---
const DATA_DIR = app.getPath('userData');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects_db.json');

console.log(`[DB] Localizado em: ${PROJECTS_FILE}`);

function ensureConfig() {
    if (!fs.existsSync(PROJECTS_FILE)) {
        const initialData = [
            {
                id: '1',
                name: 'Projeto Exemplo',
                lastDeploy: 'Nunca',
                status: 'idle',
                config: {
                    sshHost: '',
                    sshPort: '22',
                    sshUser: '',
                    sshAuthMethod: 'password',
                    destPath: '/home/',
                    localPath: app.getPath('desktop'),
                    files: ["dist"]
                }
            }
        ];
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Handlers de Dados
ipcMain.handle('get-projects', async () => {
    ensureConfig();
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
});

ipcMain.handle('save-projects', async (event, projects) => {
    try {
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Handler de Arquivos Local
ipcMain.handle('list-files', async (event, dir) => {
    let targetDir = dir || (process.platform === 'win32' ? 'C:\\' : '/');
    try {
        if (!fs.existsSync(targetDir)) return { error: "Diretório não existe" };
        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        return { 
            currentDir: targetDir,
            parentDir: path.dirname(targetDir),
            files: items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'folder' : 'file'
            }))
        };
    } catch (error) {
        return { error: error.message };
    }
});

// --- LÓGICA DE DEPLOY REAL (SSH/SipcMain.handle('run-deploy', async (event, { config }) => {
    const executionLog = [];
    const addLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        executionLog.push({ timestamp, message: msg, type });
        console.log(`[${type.toUpperCase()}] ${msg}`);
    };

    try {
        // 1. Envio de Arquivos (SCP)
        addLog(`Iniciando conexão SCP com ${config.sshHost}...`);
        const scpClient = await SCPClient({
            host: config.sshHost,
            port: parseInt(config.sshPort) || 22,
            username: config.sshUser,
            password: config.sshAuthMethod === 'password' ? config.sshPassword : undefined,
        });
        addLog(`Conexão SCP estabelecida.`, 'success');

        addLog(`Transferindo ${config.files.length} itens...`);
        for (const file of config.files) {
            try {
                const localPath = path.join(config.localPath, file);
                const remotePath = path.join(config.destPath, file).replace(/\\/g, '/');
                
                if (fs.statSync(localPath).isDirectory()) {
                    addLog(`Enviando pasta: ${file}...`);
                    await scpClient.uploadDir(localPath, remotePath);
                } else {
                    addLog(`Enviando arquivo: ${file}...`);
                    await scpClient.uploadFile(localPath, remotePath);
                }
                addLog(`Item enviado: ${file}`, 'success');
            } catch (err) {
                addLog(`Erro ao enviar ${file}: ${err.message}`, 'error');
                throw err;
            }
        }
        scpClient.close();
        addLog(`Transferência via SCP concluída.`, 'success');

        // 2. Comandos SSH (Mover, Backup, Permissões, PM2)
        if (config.finalPath || config.pm2Service) {
            addLog(`Iniciando comandos SSH de pós-deploy...`);
            await new Promise((resolve, reject) => {
                const conn = new SSHClient();
                conn.on('ready', () => {
                    const commands = [];
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

                    if (config.makeBackup && config.finalPath) {
                        config.files.forEach(file => {
                            const target = path.join(config.finalPath, file).replace(/\\/g, '/');
                            const cmd = `if [ -e "${target}" ]; then mv "${target}" "${target}_bak_${timestamp}"; fi`;
                            commands.push({ cmd: config.useSudo ? `sudo sh -c '${cmd}'` : cmd, msg: `Backup de ${file}` });
                        });
                    }

                    if (config.finalPath) {
                        config.files.forEach(file => {
                            const from = path.join(config.destPath, file).replace(/\\/g, '/');
                            const to = path.join(config.finalPath, file).replace(/\\/g, '/');
                            let moveCmd = `mkdir -p "${path.dirname(to)}" && mv "${from}" "${to}"`;
                            if (config.setPermissions) moveCmd += ` && chown -R ${config.fileOwner || 'www-data'} "${to}"`;
                            commands.push({ cmd: config.useSudo ? `sudo sh -c '${moveCmd}'` : moveCmd, msg: `Mover: ${file}` });
                        });
                    }

                    if (config.pm2Service) {
                        const restartCmd = `pm2 restart ${config.pm2Service}`;
                        commands.push({ cmd: config.useSudo ? `sudo ${restartCmd}` : restartCmd, msg: `Reiniciar PM2: ${config.pm2Service}` });
                    }

                    const executeSequentially = async () => {
                        for (const c of commands) {
                            addLog(`Executando: ${c.msg}...`);
                            try {
                                await new Promise((resCmd, rejCmd) => {
                                    conn.exec(c.cmd, (err, stream) => {
                                        if (err) return rejCmd(err);
                                        stream.on('close', (code) => {
                                            if (code === 0) resCmd();
                                            else rejCmd(new Error(`Código: ${code}`));
                                        }).on('data', (data) => console.log('SSH: ' + data))
                                          .stderr.on('data', (data) => console.log('SSH Err: ' + data));
                                    });
                                });
                                addLog(`Sucesso: ${c.msg}`, 'success');
                            } catch (err) {
                                addLog(`Falha: ${c.msg} -> ${err.message}`, 'error');
                                throw err;
                            }
                        }
                    };

                    executeSequentially()
                        .then(() => { conn.end(); resolve(); })
                        .catch(err => { conn.end(); reject(err); });

                }).on('error', (err) => {
                    addLog(`Erro de conexão SSH: ${err.message}`, 'error');
                    reject(err);
                }).connect({
                    host: config.sshHost,
                    port: parseInt(config.sshPort) || 22,
                    username: config.sshUser,
                    password: config.sshAuthMethod === 'password' ? config.sshPassword : undefined
                });
            });
        }

        return { success: true, message: "Deploy realizado com sucesso!", log: executionLog };
    } catch (error) {
        addLog(`ERRO NO DEPLOY: ${error.message}`, 'error');
        return { success: false, error: error.message, log: executionLog };
    }
});
   }
});

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

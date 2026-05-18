import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { Client } from 'node-scp';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
const port = 3001; // Not used for listening, see PORT at bottom

// Use APP_DATA_PATH passed by Electron, or fallback to current directory
const DATA_DIR = process.env.APP_DATA_PATH || process.cwd();
const CONFIG_FILE = path.join(DATA_DIR, 'projects.json');

console.log(`Configuração sendo carregada de: ${CONFIG_FILE}`);

app.use(cors());
app.use(express.json());

// Helper to ensure config file exists
async function ensureConfig() {
    try {
        await fs.access(CONFIG_FILE);
    } catch {
        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        
        const initialData = [
            {
                id: '1',
                name: 'Gestão Fort Fruit',
                lastDeploy: 'Nunca',
                status: 'online',
                config: {
                    sshHost: '10.6.0.198',
                    sshPort: '22',
                    sshUser: 'adriano-martins',
                    sshAuthMethod: 'key',
                    destPath: '/home/adriano-martins/',
                    localPath: 'C:\\Users\\Adriano\\Desktop\\gesto',
                    files: ["dist"],
                    runNpmInstall: true
                }
            },
            {
                id: '2',
                name: 'Sistema Transportadora',
                lastDeploy: 'Nunca',
                status: 'idle',
                config: {
                    sshHost: '10.6.0.198',
                    sshPort: '22',
                    sshUser: 'adriano-martins',
                    sshAuthMethod: 'key',
                    destPath: '/home/adriano-martins/',
                    localPath: 'C:\\Sistema\\painelTransortadora',
                    files: ["dist"],
                    runNpmInstall: true
                }
            }
        ];
        await fs.writeFile(CONFIG_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Endpoints
app.get('/api/projects', async (req, res) => {
    try {
        await ensureConfig();
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/files', async (req, res) => {
    let { dir } = req.query;
    
    // Se não houver diretório, começa pelo C:\ (Windows) ou / (Linux)
    if (!dir) {
        dir = process.platform === 'win32' ? 'C:\\' : '/';
    }

    try {
        try {
            await fs.access(dir);
        } catch {
            return res.status(404).json({ error: `Diretório não encontrado: ${dir}` });
        }

        const items = await fs.readdir(dir, { withFileTypes: true });
        const parentDir = path.dirname(dir);
        
        const tree = await Promise.all(items.map(async (item) => {
            try {
                if (item.isDirectory()) {
                    // Para o seletor de pastas, não precisamos carregar os filhos agora
                    return {
                        name: item.name,
                        type: 'folder'
                    };
                }
                return {
                    name: item.name,
                    type: 'file'
                };
            } catch (err) {
                return { name: item.name, type: 'folder' };
            }
        }));
        res.json({ 
            currentDir: dir,
            parentDir: parentDir !== dir ? parentDir : null,
            files: tree 
        });
    } catch (error) {
        console.error(`Erro ao listar arquivos: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/deploy', async (req, res) => {
    const { config } = req.body;
    if (!config) return res.status(400).json({ error: 'Config is required' });

    const executionLog = [];
    const addLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        executionLog.push({ timestamp, message: msg, type });
        console.log(`[${type.toUpperCase()}] ${msg}`);
    };

    try {
        // 0. Build Automático (NOVO)
        const needsBuild = config.files.some(f => f.toLowerCase().includes('dist') || f.toLowerCase().includes('build'));
        if (needsBuild) {
            addLog(`Detectada pasta de build/dist. Iniciando 'npm run build' em: ${config.localPath}...`);
            try {
                const normalizedPath = path.normalize(config.localPath);
                
                // Verificar se node_modules existe
                const nodeModulesPath = path.join(normalizedPath, 'node_modules');
                let hasNodeModules = true;
                try {
                    await fs.access(nodeModulesPath);
                } catch {
                    hasNodeModules = false;
                }

                if (!hasNodeModules) {
                    addLog(`node_modules não encontrado em ${normalizedPath}. Executando 'npm install'...`);
                    await new Promise((resolve, reject) => {
                        const install = spawn('npm', ['install'], { 
                            cwd: normalizedPath,
                            shell: true 
                        });
                        install.stdout.on('data', (data) => process.stdout.write(`[INSTALL] ${data}`));
                        install.stderr.on('data', (data) => process.stderr.write(`[INSTALL-ERR] ${data}`));
                        install.on('close', (code) => {
                            if (code === 0) {
                                addLog('Dependências instaladas com sucesso.', 'success');
                                resolve();
                            } else {
                                reject(new Error(`Falha ao instalar dependências (Código ${code})`));
                            }
                        });
                    });
                }

                // Usando spawn para streaming de logs no terminal
                await new Promise((resolve, reject) => {
                    const build = spawn('npm', ['run', 'build'], { 
                        cwd: normalizedPath,
                        shell: true // Necessário no Windows para rodar .cmd/.bat
                    });

                    build.stdout.on('data', (data) => {
                        process.stdout.write(`[BUILD] ${data}`);
                    });

                    build.stderr.on('data', (data) => {
                        process.stderr.write(`[BUILD-ERR] ${data}`);
                    });

                    build.on('close', (code) => {
                        if (code === 0) {
                            addLog('Build local concluído com sucesso.', 'success');
                            resolve();
                        } else {
                            addLog(`Erro no build local (Código ${code}). Verifique o terminal.`, 'error');
                            reject(new Error(`Build falhou com código ${code}`));
                        }
                    });

                    build.on('error', (err) => {
                        addLog(`Falha ao iniciar build: ${err.message}`, 'error');
                        reject(err);
                    });
                });
            } catch (buildError) {
                // O erro já foi logado no addLog dentro da promise
                throw buildError;
            }
        }

        addLog(`Conectando ao servidor SSH: ${config.sshHost}...`);
        const client = await Client({
            host: config.sshHost,
            port: parseInt(config.sshPort) || 22,
            username: config.sshUser,
            password: config.sshAuthMethod === 'password' ? config.sshPassword : undefined,
            agentForward: false,
            readyTimeout: 10000 
        });
        addLog(`Conexão SSH estabelecida.`, 'success');

        addLog(`Iniciando transferência de ${config.files.length} itens...`);
        
        // Criar as pastas de destino no servidor antes de enviar (silencioso se já existir)
        for (const file of config.files) {
            try {
                const remoteDir = path.dirname(path.join(config.destPath, file)).replace(/\\/g, '/');
                if (remoteDir !== '.') await client.mkdir(remoteDir); 
            } catch (err) {
                // Ignora erro se a pasta já existir
            }
        }

        for (let file of config.files) {
            file = file.trim(); // Remove espaços em branco acidentais
            try {
                const localPath = path.resolve(config.localPath, file);
                const remotePath = path.join(config.destPath, file).replace(/\\/g, '/');
                
                addLog(`Verificando caminho local: ${localPath}`);
                const stats = await fs.stat(localPath);
                if (stats.isDirectory()) {
                    addLog(`Enviando pasta: ${file}...`);
                    await client.uploadDir(localPath, remotePath);
                } else {
                    addLog(`Enviando arquivo: ${file}...`);
                    await client.uploadFile(localPath, remotePath);
                }
                addLog(`Item enviado: ${file}`, 'success');
            } catch (err) {
                addLog(`Falha ao enviar ${file}: ${err.message}`, 'error');
                throw err; // Interrompe se falhar o envio
            }
        }

        client.close();
        addLog(`Transferência concluída.`, 'success');

        if (config.finalPath || config.pm2Service) {
            addLog(`Iniciando comandos de pós-deploy no servidor...`);
            const { Client: SSHClient } = await import('ssh2');
            
            await new Promise((resolve, reject) => {
                const conn = new SSHClient();
                conn.on('ready', () => {
                    const commands = [];
                    const timestamp = "$(date +%Y%m%d_%H%M)";

                    // 1. BACKUP
                    if (config.makeBackup && config.finalPath && !config.directUpload) {
                        config.files.forEach(file => {
                            const target = path.join(config.finalPath, file).replace(/\\/g, '/');
                            const backupName = `${target}_backup_${timestamp}`;
                            let cmd = `if [ -e "${target}" ]; then mv -f "${target}" "${backupName}"; fi`;
                            if (config.useSudo) {
                                if (config.sshAuthMethod === 'password') cmd = `echo "${config.sshPassword}" | sudo -S sh -c '${cmd}'`;
                                else cmd = `sudo sh -c '${cmd}'`;
                            }
                            commands.push({ cmd, msg: `Backup de ${file}` });
                        });
                    }

                    // 2. MOVE / PERMISSIONS
                    if (config.finalPath && !config.directUpload) {
                        config.files.forEach(file => {
                            const from = path.join(config.destPath, file).replace(/\\/g, '/');
                            const to = path.join(config.finalPath, file).replace(/\\/g, '/');
                            let moveCmd = `mkdir -p "${path.dirname(to).replace(/\\/g, '/')}" && mv -f "${from}" "${to}"`;
                            if (config.setPermissions) {
                                const owner = config.fileOwner || 'www-data:www-data';
                                moveCmd += ` && chown -R ${owner} "${to}" && chmod -R 755 "${to}"`;
                            }
                            if (config.useSudo) {
                                if (config.sshAuthMethod === 'password') moveCmd = `echo "${config.sshPassword}" | sudo -S sh -c '${moveCmd}'`;
                                else moveCmd = `sudo sh -c '${moveCmd}'`;
                            }
                            commands.push({ cmd: moveCmd, msg: `Mover/Permissões: ${file}` });
                        });
                    } else if (config.directUpload && config.setPermissions) {
                        // Se for envio direto, apenas aplicamos permissões no local final (destPath)
                        config.files.forEach(file => {
                            const target = path.join(config.destPath, file).replace(/\\/g, '/');
                            let permCmd = `chown -R ${config.fileOwner || 'www-data:www-data'} "${target}" && chmod -R 755 "${target}"`;
                            if (config.useSudo) {
                                if (config.sshAuthMethod === 'password') permCmd = `echo "${config.sshPassword}" | sudo -S sh -c '${permCmd}'`;
                                else permCmd = `sudo sh -c '${permCmd}'`;
                            }
                            commands.push({ cmd: permCmd, msg: `Aplicar Permissões: ${file}` });
                        });
                    }

                    // 2.5 NPM INSTALL
                    if (config.runNpmInstall && (config.finalPath || config.directUpload)) {
                        const targetPath = config.directUpload ? config.destPath : config.finalPath;
                        let npmCmd = `cd "${targetPath}" && npm install`;
                        if (config.useSudo) {
                            if (config.sshAuthMethod === 'password') npmCmd = `echo "${config.sshPassword}" | sudo -S sh -c '${npmCmd}'`;
                            else npmCmd = `sudo sh -c '${npmCmd}'`;
                        }
                        commands.push({ cmd: npmCmd, msg: `Instalar dependências (npm install)` });
                    }

                    // 3. PM2
                    if (config.pm2Service) {
                        let restartCmd = `pm2 restart ${config.pm2Service}`;
                        if (config.useSudo) {
                            if (config.sshAuthMethod === 'password') restartCmd = `echo "${config.sshPassword}" | sudo -S ${restartCmd}`;
                            else restartCmd = `sudo ${restartCmd}`;
                        }
                        commands.push({ cmd: restartCmd, msg: `Reiniciar PM2: ${config.pm2Service}` });
                    }

                    // Executar um por um para log detalhado
                    const executeSequentially = async () => {
                        for (const c of commands) {
                            addLog(`Executando: ${c.msg}...`);
                            try {
                                await new Promise((resCmd, rejCmd) => {
                                    conn.exec(c.cmd, (err, stream) => {
                                        if (err) return rejCmd(err);
                                        stream.on('close', (code) => {
                                            if (code === 0) resCmd();
                                            else rejCmd(new Error(`Código de saída: ${code}`));
                                        }).on('data', (data) => console.log('STDOUT: ' + data))
                                          .stderr.on('data', (data) => console.log('STDERR: ' + data));
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

        res.json({ 
            success: true, 
            message: config.finalPath ? 'Deploy e movimentação finalizados!' : 'Deploy finalizado com sucesso!',
            log: executionLog 
        });
    } catch (error) {
        addLog(`ERRO CRÍTICO: ${error.message}`, 'error');
        res.status(500).json({ 
            success: false, 
            error: error.message,
            log: executionLog 
        });
    }
});

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => {
    console.log(`🚀 Backend de Deploy rodando em: http://localhost:${PORT}`);
});

import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  TerminalSquare,
  Settings,
  Plus,
  Send,
  Loader2,
  X,
  FileBox,
  Computer,
  FolderOpen,
  Search,
  CheckSquare,
  Square,
  Rocket,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Home as HomeIcon,
  Activity,
  Cpu,
  Globe,
  Zap,
  Shield,
  Terminal,
  Database,
  Lock,
  Wifi,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Removido Mock de Projetos e File Tree para usar API real
const API_BASE = ''; // Usar vazio para que o proxy do Vite direcione para o backend na porta 8085

declare global {
  interface Window {
    electronAPI: {
      getProjects: () => Promise<any[]>;
      saveProjects: (projects: any[]) => Promise<any>;
      listFiles: (dir: string) => Promise<any>;
      runDeploy: (config: any) => Promise<any>;
    }
  }
}

export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => localStorage.getItem('selectedProjectId'));
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'home');
  const [fileTree, setFileTree] = useState<any[]>([]);
  
  // Persist activeTab and selectedProjectId
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedProjectId', selectedProjectId);
    }
  }, [selectedProjectId]);
  
  // Load projects using IPC or API
  const loadProjects = async () => {
    try {
      let data;
      if (window.electronAPI) {
        data = await window.electronAPI.getProjects();
      } else {
        const response = await fetch(`${API_BASE}/api/projects`);
        data = await response.json();
      }
      
      setProjects(data);
      if (data.length > 0) {
        const exists = data.find((p: any) => p.id === selectedProjectId);
        if (!exists) setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null);
  const config = selectedProject?.config || { 
    sshHost: '', 
    sshPort: '22', 
    sshUser: '', 
    sshPassword: '',
    sshAuthMethod: 'key', 
    destPath: '', 
    finalPath: '',
    useSudo: true,
    makeBackup: true,
    setPermissions: true,
    fileOwner: 'www-data:www-data',
    pm2Service: '',
    localPath: '', 
    files: [],
    runNpmInstall: true
  };

  const saveProjects = async (updatedProjects: any[]) => {
    if (updatedProjects.length === 0) return;
    
    // Remover senhas antes de salvar no arquivo/persistência
    const projectsToSave = updatedProjects.map(p => ({
      ...p,
      config: {
        ...p.config,
        sshPassword: '' // Sempre salva vazio
      }
    }));

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.saveProjects(projectsToSave);
        if (!result.success) alert("Erro ao salvar: " + result.error);
      } else {
        const response = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectsToSave)
        });
        const result = await response.json();
        if (!result.success) alert("Erro ao salvar: " + result.error);
      }
    } catch (err) {
      console.error("Erro ao salvar projetos:", err);
    }
  };

  const updateConfig = (newConfig: any) => {
    if (!selectedProjectId) return;
    const updated = projects.map(p => 
      p.id === selectedProjectId ? { ...p, config: { ...p.config, ...newConfig } } : p
    );
    setProjects(updated);
    saveProjects(updated);
  };
  
  // Deploy State
  const [isSending, setIsSending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const [newFileInput, setNewFileInput] = useState('');
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerMode, setExplorerMode] = useState<'files' | 'folder'>('files');
  const [currentBrowsingDir, setCurrentBrowsingDir] = useState('');
  const [parentBrowsingDir, setParentBrowsingDir] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Fetch real file tree when explorer opens
  useEffect(() => {
    if (isExplorerOpen) {
      const dirToFetch = currentBrowsingDir || (explorerMode === 'files' ? config.localPath : '');
      
      const handleData = (data: any) => {
        if (data.files && Array.isArray(data.files)) {
          setFileTree(data.files);
          setCurrentBrowsingDir(data.currentDir);
          setParentBrowsingDir(data.parentDir);
        } else {
          console.error("Backend não retornou o formato esperado:", data);
          setFileTree([]);
        }
      };

      if (window.electronAPI) {
        window.electronAPI.listFiles(dirToFetch)
          .then(handleData)
          .catch(err => {
            console.error("Erro ao ler pasta local via IPC:", err);
            setFileTree([]);
          });
      } else {
        fetch(`${API_BASE}/api/files?dir=${encodeURIComponent(dirToFetch)}`)
          .then(res => res.json())
          .then(handleData)
          .catch(err => {
            console.error("Erro ao ler pasta local:", err);
            setFileTree([]);
          });
      }
    }
  }, [isExplorerOpen, currentBrowsingDir, explorerMode]);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, `[${type.toUpperCase()}] ${msg}`]);
  };

  const startSending = async () => {
    if (!selectedProject || config.files.length === 0) return;
    
    setLogs([]);
    setLogs(prev => [...prev, `🚀 Iniciando deploy real: ${selectedProject.name}`]);
    setLogs(prev => [...prev, `📂 Origem: ${config.localPath}`]);
    setLogs(prev => [...prev, `🌐 Destino: ${config.sshHost}:${config.destPath}`]);
    
    setIsSending(true);
    const loadingInterval = setInterval(() => {
      setLogs(prev => {
        const last = prev[prev.length - 1];
        if (last && last.startsWith('⏳ Processando')) {
          const dots = last.split('.').length - 1;
          return [...prev.slice(0, -1), `⏳ Processando${'.'.repeat((dots % 3) + 1)}` ];
        }
        return [...prev, '⏳ Processando.'];
      });
    }, 500);

    try {
      // Log individual files being sent
      setLogs(prev => [...prev, `📦 Preparando ${config.files.length} item(s)...`]);
      
      let result;
      if (window.electronAPI) {
        result = await window.electronAPI.runDeploy({ config });
      } else {
        const response = await fetch(`${API_BASE}/api/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config })
        });
        result = await response.json();
      }
      
      clearInterval(loadingInterval);
      setLogs(prev => prev.filter(l => !l.startsWith('⏳ Processando')));
      
      // Se houver log detalhado do backend, use-o
      if (result.log && Array.isArray(result.log)) {
        result.log.forEach((entry: any) => {
          setLogs(prev => [...prev, `${entry.type === 'success' ? '✅' : (entry.type === 'error' ? '❌' : 'ℹ️')} [${entry.timestamp}] ${entry.message}`]);
        });
      }

      if (result.success) {
        setLogs(prev => [...prev, `\n✅ Sucesso: ${result.message}`]);
        updateConfig({ lastDeploy: new Date().toLocaleString() });
      } else {
        setLogs(prev => [...prev, `\n❌ Erro no processo: ${result.error}`]);
      }
    } catch (err: any) {
      clearInterval(loadingInterval);
      setLogs(prev => prev.filter(l => !l.startsWith('⏳ Processando')));
      setLogs(prev => [...prev, `❌ Falha crítica de rede/servidor: ${err.message}`]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddFile = () => {
    if (newFileInput.trim() && !config.files.includes(newFileInput.trim())) {
      updateConfig({ files: [...config.files, newFileInput.trim()] });
      setNewFileInput('');
    }
  };

  const handleFileSelect = (fileName: string) => {
    // Calcular caminho relativo à pasta raiz do projeto
    const normalizedLocal = config.localPath.replace(/\\/g, '/').toLowerCase();
    const normalizedCurrent = currentBrowsingDir.replace(/\\/g, '/').toLowerCase();
    
    let relativePath = '';
    if (normalizedCurrent.startsWith(normalizedLocal)) {
      relativePath = currentBrowsingDir.substring(config.localPath.length);
      // Remover separador inicial se houver
      if (relativePath.startsWith('\\') || relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
    }

    const fullRelativePath = relativePath 
      ? `${relativePath}/${fileName}`.replace(/\\/g, '/')
      : fileName;

    if (config.files.includes(fullRelativePath)) {
      handleRemoveFile(fullRelativePath);
    } else {
      updateConfig({ files: [...config.files, fullRelativePath] });
    }
  };

  const handleRemoveFile = (fileToRemove: string) => {
    updateConfig({ files: config.files.filter(f => f !== fileToRemove) });
  };

  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    
    const newId = Date.now().toString();
    const newProject = {
      id: newId,
      name: newProjectName,
      lastDeploy: 'Nunca',
      status: 'idle',
      config: {
        sshHost: '10.6.0.198',
        sshPort: '22',
        sshUser: 'adriano-martins',
        sshPassword: '',
        sshAuthMethod: 'password',
        destPath: '/home/adriano-martins/',
        finalPath: '',
        useSudo: true,
        makeBackup: true,
        setPermissions: true,
        fileOwner: 'www-data:www-data',
        pm2Service: '',
        localPath: '',
        files: ['dist'],
        runNpmInstall: true
      }
    };
    const updated = [...projects, newProject];
    setProjects(updated);
    setSelectedProjectId(newId);
    saveProjects(updated);
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    setActiveTab('config');
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    saveProjects(updated);
    if (selectedProjectId === id) {
      setSelectedProjectId(updated.length > 0 ? updated[0].id : null);
    }
    setProjectToDelete(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#111111] text-gray-200 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <motion.div 
        animate={{ width: isSidebarCollapsed ? 64 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-[#1a1a1a] border-r border-[#333] flex flex-col shrink-0 relative z-20"
      >
        <div className={`p-4 flex items-center border-b border-[#333] ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <TerminalSquare size={20} />
              </div>
              <h1 className="font-semibold tracking-tight text-white">Deploy</h1>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <TerminalSquare size={20} />
            </div>
          )}
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#333] transition-colors ${isSidebarCollapsed ? 'mt-2' : ''}`}
            title={isSidebarCollapsed ? "Expandir" : "Recolher"}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          {!isSidebarCollapsed && (
            <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Projetos Salvos
            </div>
          )}
          <div className="space-y-1">
            {projects.map(p => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2
                    ${selectedProjectId === p.id 
                      ? 'border-emerald-500 bg-[#252525]' 
                      : 'border-transparent hover:bg-[#222]'}
                    ${isSidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <div className={`shrink-0 ${selectedProjectId === p.id ? 'text-emerald-500' : 'text-gray-500'}`}>
                    <Server size={18} />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className={`font-medium truncate ${selectedProjectId === p.id ? 'text-white' : 'text-gray-300'}`}>
                        {p.name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono truncate">Último: {p.lastDeploy}</span>
                    </div>
                  )}
                </button>
                {!isSidebarCollapsed && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setProjectToDelete(p.id); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a1a] rounded-md shadow-lg"
                    title="Excluir Projeto"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[#333]">
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className={`w-full py-2 rounded-md border border-dashed border-[#444] text-gray-400 hover:text-white hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2 text-sm font-medium ${isSidebarCollapsed ? 'px-0' : 'px-4'}`}
            title="Novo Projeto"
          >
            <Plus size={16} />
            {!isSidebarCollapsed && "Novo Projeto"}
          </button>
        </div>
      </motion.div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        
        {/* HEADER */}
        <header className="h-16 border-b border-[#222] bg-[#111111] flex items-center px-6 shrink-0">
          <h2 className="text-lg font-medium text-white flex gap-2 items-center">
            {selectedProject?.name || 'Nenhum Projeto'}
          </h2>
          
          {/* TABS */}
          <div className="ml-12 flex gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'home' 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/30' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
              }`}
            >
              <HomeIcon size={16} />
              Home
            </button>
            <button
              onClick={() => setActiveTab('enviar')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'enviar' 
                ? 'bg-[#333] text-white shadow-sm' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
              }`}
            >
              <Send size={16} />
              Enviar
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'config' 
                ? 'bg-[#333] text-white shadow-sm' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
              }`}
            >
              <Settings size={16} />
              Configuração
            </button>
          </div>
        </header>

        {/* SCANLINE & GRAIN EFFECT */}
        {activeTab === 'home' && (
          <>
            <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden opacity-[0.05]">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_3px,4px_100%]" />
            </div>
            <div className="pointer-events-none fixed inset-0 z-[61] opacity-[0.02] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          </>
        )}

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          
          {/* TAB: HOME (ADVANCED HACKER STYLE) */}
          {activeTab === 'home' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-[1400px] mx-auto space-y-6 pb-10"
            >
              {/* TOP BIOS HEADER */}
              <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-emerald-500/20 pb-4 font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-[0.3em]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    System Status: Secure
                  </div>
                  <h1 className="text-4xl font-black text-white flex items-baseline gap-2">
                    <span className="text-emerald-500">FF</span>_CORE <span className="text-xs text-gray-600 font-normal">v4.0.8-stable</span>
                  </h1>
                </div>
                <div className="text-[10px] text-gray-500 text-right space-y-0.5 mt-4 md:mt-0">
                  <p>OS: LINUX_NODE_X64</p>
                  <p>KERNEL: 5.15.0-72-GENERIC</p>
                  <p>LOCAL_IP: 127.0.0.1</p>
                  <p>TIMESTAMP: {new Date().toISOString()}</p>
                </div>
              </div>

              {/* MAIN DASHBOARD GRID */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* LEFT COLUMN: NODE MONITOR */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                  <div className="bg-[#111] border border-[#222] rounded-lg p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                        <Wifi size={12} /> Active Nodes
                      </h3>
                      <span className="text-[9px] text-gray-600">0{projects.length} online</span>
                    </div>
                    <div className="space-y-3">
                      {projects.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 group/item">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-gray-300 font-bold truncate group-hover/item:text-emerald-400 transition-colors">{p.name}</div>
                            <div className="text-[9px] text-gray-600 font-mono">{p.config.sshHost}</div>
                          </div>
                          <div className="text-[9px] text-emerald-500 font-mono">2ms</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-[#222]">
                       <div className="text-[9px] text-gray-500 uppercase mb-2">Network Traffic</div>
                       <div className="flex gap-0.5 h-4 items-end">
                         {[...Array(20)].map((_, i) => (
                           <motion.div 
                            key={i} 
                            animate={{ height: [2, Math.random() * 16 + 2, 2] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                            className="flex-1 bg-emerald-500/20" 
                           />
                         ))}
                       </div>
                    </div>
                  </div>

                  <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Lock size={12} /> Auth Protocols
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">SSH_AUTH</span>
                        <span className="text-emerald-500">RSA_ENABLED</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">SSL_PROXY</span>
                        <span className="text-emerald-500">ACTIVE</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">FIREWALL</span>
                        <span className="text-red-500/70">BYPASSED</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CENTER COLUMN: MAIN VISUALIZATION */}
                <div className="col-span-12 lg:col-span-6 space-y-6">
                  <div className="bg-[#050505] border-2 border-[#1a1a1a] rounded-lg h-[400px] relative overflow-hidden flex items-center justify-center group shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                    {/* ASCII ART BACKGROUND */}
                    <pre className="absolute inset-0 p-4 text-[8px] leading-[8px] text-emerald-500/5 select-none pointer-events-none overflow-hidden font-mono text-center">
                      {`
                        
     ███████╗ ██████╗ ██████╗ ████████╗███████╗██████╗ ██╗   ██╗██╗████████╗
     ██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██║   ██║██║╚══██╔══╝
     █████╗  ██║   ██║██████╔╝   ██║   █████╗  ██████╔╝██║   ██║██║   ██║   
     ██╔══╝  ██║   ██║██╔══██╗   ██║   ██╔══╝  ██╔══██╗██║   ██║██║   ██║   
     ██║     ╚██████╔╝██║  ██║   ██║   ██║     ██║  ██║╚██████╔╝██║   ██║   
     ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝   ╚═╝   
                                                                            
                      `.repeat(10)}
                    </pre>

                    {/* CENTRAL MODULE */}
                    <div className="relative z-10 text-center space-y-6">
                      <div className="relative">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
                          className="w-48 h-48 border-4 border-dashed border-emerald-500/20 rounded-full flex items-center justify-center"
                        />
                        <motion.div 
                          animate={{ rotate: -360 }}
                          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                          className="absolute inset-0 m-auto w-32 h-32 border-2 border-emerald-500/40 rounded-full border-t-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        />
                        <div className="absolute inset-0 m-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/50">
                           <Rocket size={24} className="text-emerald-500 animate-bounce" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase">Ready for Deployment</h2>
                        <p className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest">Protocols initialized // Waiting for Project Selection</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('enviar')}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-xs tracking-[0.3em] rounded-sm transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                      >
                        Launch_Terminal
                      </button>
                    </div>

                    {/* OVERLAY CORNERS */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500/30 m-4" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500/30 m-4" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500/30 m-4" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500/30 m-4" />
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { label: 'CPU_LOAD', value: '0.4%', icon: Cpu },
                      { label: 'MEM_ALLOC', value: '1.2GB', icon: Database },
                      { label: 'HDD_AVAIL', value: '450GB', icon: HardDrive },
                    ].map((m, i) => (
                      <div key={i} className="bg-[#111] border border-[#222] p-3 rounded-lg flex items-center gap-3">
                         <div className="p-2 bg-emerald-500/5 rounded border border-emerald-500/10 text-emerald-500">
                           <m.icon size={14} />
                         </div>
                         <div>
                            <div className="text-[8px] text-gray-500 font-bold uppercase">{m.label}</div>
                            <div className="text-xs font-mono text-white">{m.value}</div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT COLUMN: LIVE LOGS */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                  <div className="bg-[#0c0c0c] border border-[#222] rounded-lg h-full flex flex-col overflow-hidden relative">
                    <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Terminal size={12} /> Live_Feed
                      </h3>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                    <div className="p-4 flex-1 font-mono text-[9px] leading-relaxed overflow-hidden">
                       <div className="space-y-1.5 text-emerald-500/40">
                          <p className="text-emerald-500/80">{"[INFO] Initializing system sequence..."}</p>
                          <p>{"[OK] Node.js environment detected"}</p>
                          <p>{"[OK] SSH modules loaded"}</p>
                          <p className="text-blue-400">{"[SEC] RSA keys handshake complete"}</p>
                          <p>{"[OK] Project database synchronized"}</p>
                          <p>{"[OK] GUI rendering: 144fps"}</p>
                          <p className="text-yellow-500/70">{"[WARN] Latency detected in node-02"}</p>
                          <p>{"[INFO] Scanning for local changes..."}</p>
                          <p>{"[OK] Found 4 modified files in SistemaFF"}</p>
                          <p className="animate-pulse text-emerald-500">{"[READY] Awaiting user command_"}</p>
                       </div>
                       
                       <div className="mt-10 pt-10 border-t border-[#111] space-y-4">
                          <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/10">
                             <div className="text-[8px] text-emerald-500 font-bold uppercase mb-2">Last Deployment</div>
                             <div className="text-[11px] text-white font-bold">{projects[0]?.name || 'N/A'}</div>
                             <div className="text-[9px] text-gray-600 mt-1">{projects[0]?.lastDeploy || 'Never'}</div>
                          </div>
                          
                          <div className="p-3 bg-blue-500/5 rounded border border-blue-500/10">
                             <div className="text-[8px] text-blue-500 font-bold uppercase mb-2">System Uptime</div>
                             <div className="text-[11px] text-white font-mono">04:22:15:09</div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* BOTTOM COMMAND BAR MOCK */}
              <div className="bg-[#111] border border-[#222] rounded-lg p-2 px-4 flex items-center gap-4 text-xs font-mono text-gray-600">
                <span className="text-emerald-500">adr@deploy-manager:~$</span>
                <span className="flex-1 overflow-hidden whitespace-nowrap">
                  <motion.span 
                    animate={{ opacity: [1, 0, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-2 h-4 bg-emerald-500 align-middle ml-1" 
                  />
                </span>
                <div className="flex gap-4 text-[10px] uppercase">
                  <span>RAM: 12%</span>
                  <span>CPU: 4%</span>
                  <span>NET: 44kb/s</span>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB: ENVIAR */}

          {/* TAB: ENVIAR */}
          {activeTab === 'enviar' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* RESUMO CARD */}
              <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between shadow-lg gap-4">
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold text-white">Resumo do Envio</h3>
                  <div className="text-sm space-y-1">
                    <p className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500 w-16">Origem:</span> 
                      <span className="font-mono bg-[#111] px-2 py-0.5 rounded border border-[#222] truncate max-w-sm">{config.localPath}</span>
                    </p>
                    <p className="flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500 w-16">Destino:</span> 
                      <span className="font-mono text-emerald-400">{config.sshHost}:{config.destPath}</span>
                    </p>
                  </div>
                  
                  <div className="pt-2">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 block">Itens que serão enviados ({config.files.length})</span>
                    <div className="flex flex-wrap gap-2">
                      {config.files.map(item => (
                        <span key={item} className="px-2.5 py-1 bg-[#222] border border-[#333] rounded text-xs font-mono text-gray-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 border-t border-[#2a2a2a] pt-4 md:border-t-0 md:pt-0 md:pl-6 md:border-l">
                  <button 
                    onClick={startSending}
                    disabled={isSending || config.files.length === 0}
                    className={`w-full md:w-auto px-8 py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-all text-lg shadow-lg ${
                      isSending || config.files.length === 0
                      ? 'bg-emerald-500/10 text-emerald-500/50 cursor-not-allowed border border-emerald-500/20' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isSending ? (
                      <><Loader2 size={24} className="animate-spin" /> Enviando...</>
                    ) : (
                      <><Rocket size={24} /> Deploy</>
                    )}
                  </button>
                </div>
              </div>

              {/* CONSOLE */}
              <div className="bg-[#0c0c0c] border border-[#2a2a2a] rounded-xl p-1 flex flex-col shadow-inner">
                <div className="px-4 py-2 border-b border-[#222] flex items-center justify-between text-xs font-mono text-gray-500">
                  <span className="flex items-center gap-2">
                    <TerminalSquare size={14} /> 
                    saída_scp.log
                  </span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  </div>
                </div>
                <div 
                  ref={consoleRef}
                  className="p-4 font-mono text-xs text-gray-300 overflow-y-auto h-[400px] leading-relaxed relative"
                >
                  {!isSending && logs.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 italic">
                      <FolderOpen size={32} className="mb-2 opacity-50" />
                      Pronto para iniciar envio...
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={`
                        mb-0.5 
                        ${log.includes('Sucesso') || log.includes('sucesso') || log.includes('DONE') ? 'text-emerald-400' : ''}
                        ${log.includes('Erro') || log.includes('falha') || log.includes('❌') ? 'text-red-400' : ''}
                        ${log.includes('⏳') ? 'text-blue-400 italic' : ''}
                        ${log.includes('|__') ? 'text-gray-500' : ''}
                      `}>
                        {log.includes('DONE') ? (
                          <>
                            {log.split('DONE')[0]}
                            <span className="text-emerald-500 font-bold">DONE</span>
                            {log.split('DONE')[1]}
                          </>
                        ) : log}
                      </div>
                    ))
                  )}
                  {isSending && <span className="animate-pulse">_</span>}
                </div>
              </div>

            </div>
          )}

          {/* TAB: CONFIG */}
          {activeTab === 'config' && (
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">Configurações de Envio</h3>
              </div>

              <div className="space-y-6">
                
                {/* 1. SSH CARD */}
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5 fade-in">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
                    <Server size={18} className="text-emerald-500" /> Servidor SSH
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Host (IP / Domínio)</label>
                        <input type="text" value={config.sshHost} onChange={(e) => updateConfig({ sshHost: e.target.value})} className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Porta</label>
                        <input type="text" value={config.sshPort} onChange={(e) => updateConfig({ sshPort: e.target.value})} className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Usuário</label>
                        <input type="text" value={config.sshUser} onChange={(e) => updateConfig({ sshUser: e.target.value})} className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                      </div>
                      <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Senha (opcional se usar chave)</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={config.sshPassword} 
                          onChange={(e) => updateConfig({ sshPassword: e.target.value})} 
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:border-emerald-500 font-mono text-gray-200" 
                        />
                        <button 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? <X size={16} /> : <Search size={16} />} {/* Using available icons as proxy for eye/eye-off */}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Método Auth</label>
                    <select 
                      value={config.sshAuthMethod} 
                      onChange={(e) => updateConfig({ sshAuthMethod: e.target.value})} 
                      className={`w-full bg-[#0a0a0a] border rounded-md px-3 py-2 text-sm focus:outline-none text-gray-300 ${config.sshAuthMethod === 'key' && config.sshPassword ? 'border-orange-500/50 bg-orange-500/5' : 'border-[#333] focus:border-emerald-500'}`}
                    >
                      <option value="key">Chave SSH (id_rsa)</option>
                      <option value="password">Senha (Recomendado se preencheu senha acima)</option>
                    </select>
                    {config.sshAuthMethod === 'key' && config.sshPassword && (
                      <p className="text-[10px] text-orange-400 mt-1 flex items-center gap-1">
                         Atenção: Você preencheu a senha, mas o método está como "Chave". Mude para "Senha".
                      </p>
                    )}
                  </div>
                  </div>
                </div>

                {/* 2. PASTA DE DESTINO CARD */}
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
                    <FolderOpen size={18} className="text-purple-500" /> Pasta de Destino no Servidor
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Caminho absoluto da pasta</label>
                    <input 
                      type="text" 
                      value={config.destPath} 
                      onChange={(e) => updateConfig({ destPath: e.target.value})} 
                      placeholder="/home/adriano-martins/" 
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono text-gray-200" 
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                      Os arquivos serão copiados temporariamente para esta pasta (ex: seu diretório home).
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#222]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Caminho Final (Opcional - Mover após upload)</label>
                    <input 
                      type="text" 
                      value={config.finalPath} 
                      onChange={(e) => updateConfig({ finalPath: e.target.value})} 
                      placeholder="/var/www/html/meu-projeto/" 
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono text-gray-200" 
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Se preenchido, o sistema moverá os arquivos para este caminho usando 'mv' via SSH após o envio.
                    </p>
                    {config.finalPath && (
                      <div className="mt-3 flex items-center gap-2">
                        <button 
                          onClick={() => updateConfig({ useSudo: !config.useSudo })}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all text-xs font-medium ${
                            config.useSudo 
                            ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                            : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          {config.useSudo ? <CheckSquare size={14} /> : <Square size={14} />}
                          Usar SUDO (para pastas protegidas como /var/www)
                        </button>
                      </div>
                    )}
                    
                    {config.finalPath && (
                      <div className="mt-4 pt-4 border-t border-[#222] space-y-4">
                        <div className="flex items-center gap-2 text-emerald-500/80">
                          <ShieldCheck size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Proteção Ativa: Backup + Permissões</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#0c0c0c] p-2.5 rounded border border-[#222]">
                            <label className="block text-[9px] text-gray-500 font-bold uppercase mb-1">Dono dos Arquivos</label>
                            <input 
                              type="text" 
                              value={config.fileOwner} 
                              onChange={(e) => updateConfig({ fileOwner: e.target.value})} 
                              className="w-full bg-transparent text-xs text-emerald-500 font-mono focus:outline-none" 
                            />
                          </div>
                          <div className="bg-[#0c0c0c] p-2.5 rounded border border-[#222] opacity-60">
                            <label className="block text-[9px] text-gray-500 font-bold uppercase mb-1">Backup (Timestamp)</label>
                            <div className="text-[10px] text-gray-400 font-mono">Auto-gerado</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. PASTA LOCAL CARD */}
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
                    <Computer size={18} className="text-blue-400" /> Pasta Local do Projeto
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Caminho da pasta raiz no computador
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={config.localPath}
                        onChange={(e) => updateConfig({ localPath: e.target.value})}
                        placeholder="C:\Users\Adriano\Desktop\gesto" 
                        className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-mono" 
                      />
                      <button 
                        onClick={() => {
                          setExplorerMode('folder');
                          setCurrentBrowsingDir(config.localPath);
                          setIsExplorerOpen(true);
                        }}
                        className="px-3 py-2 bg-[#222] hover:bg-[#333] text-blue-400 border border-[#333] rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Search size={14} /> Local...
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. ARQUIVOS CARD */}
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
                    <FileBox size={18} className="text-orange-400" /> Arquivos a Enviar
                  </h4>
                  
                  <div className="space-y-2 mb-4">
                    {config.files.length === 0 && (
                      <p className="text-sm text-gray-500 italic py-2">Nenhum arquivo na lista de envio.</p>
                    )}
                    {config.files.map((file) => (
                      <div key={file} className="flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] px-3 py-2 rounded-md group">
                        <span className="text-sm font-mono text-gray-300">{file}</span>
                        <div className="flex items-center gap-2">
                          {file === 'dist' && (
                            <span className="text-[10px] uppercase font-bold text-emerald-500/60 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20 mr-1">Principal</span>
                          )}
                          <button 
                            onClick={() => handleRemoveFile(file)}
                            className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors"
                            title="Remover"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newFileInput}
                      onChange={(e) => setNewFileInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddFile()}
                      placeholder="caminho/relativo/do/arquivo_ou_pasta" 
                      className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono" 
                    />
                    <button 
                      onClick={() => {
                        setExplorerMode('files');
                        setCurrentBrowsingDir(config.localPath);
                        setIsExplorerOpen(true);
                      }}
                      className="px-3 py-2 bg-[#222] hover:bg-[#333] text-gray-300 border border-[#444] rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                      title="Procurar na pasta local"
                    >
                      <Search size={14} /> Local...
                    </button>
                    <button 
                      onClick={handleAddFile}
                      disabled={!newFileInput.trim()}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-[#333] disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Caminhos relativos à pasta local. Se for uma pasta (ex: "dist"), usaremos scp -r.</p>
                </div>

                {/* 5. COMANDOS PÓS-DEPLOY */}
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-xl p-5 fade-in mt-6">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
                    <Rocket size={18} className="text-blue-500" /> Comandos Pós-Deploy
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Reiniciar Serviço PM2 (Opcional)</label>
                      <input 
                        type="text" 
                        value={config.pm2Service} 
                        onChange={(e) => updateConfig({ pm2Service: e.target.value})} 
                        placeholder="Ex: transportadora" 
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono text-gray-200" 
                      />
                      <p className="text-[10px] text-gray-500 mt-2 italic">
                        {config.pm2Service 
                          ? `O sistema executará: pm2 restart ${config.pm2Service}` 
                          : 'Nenhum serviço será reiniciado automaticamente.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#222]">
                      <button 
                        onClick={() => updateConfig({ runNpmInstall: !config.runNpmInstall })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all text-xs font-medium ${
                          config.runNpmInstall 
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' 
                          : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        {config.runNpmInstall ? <CheckSquare size={14} /> : <Square size={14} />}
                        Executar NPM Install (Instalar dependências)
                      </button>
                      <p className="text-[10px] text-gray-500 mt-2 italic">
                        Recomendado se o seu package.json foi alterado. Executado após mover os arquivos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MOCK FILE EXPLORER MODAL */}
          {isExplorerOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#151515] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FolderOpen size={18} className="text-blue-400" /> Explorador Local
                  </h3>
                  <button onClick={() => setIsExplorerOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4 border-b border-[#222] bg-[#0c0c0c] flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Caminho Atual:</div>
                    <div className="font-mono text-sm text-gray-300 truncate">{currentBrowsingDir}</div>
                  </div>
                  {parentBrowsingDir && (
                    <button 
                      onClick={() => setCurrentBrowsingDir(parentBrowsingDir)}
                      className="ml-4 p-1.5 bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white rounded transition-colors"
                      title="Voltar para pasta pai"
                    >
                      <Plus size={16} className="rotate-45" /> {/* Simulating a back/up icon with tilted plus */}
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto max-h-80 p-2 space-y-1 bg-[#111]">
                  {fileTree.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Nenhum item encontrado ou pasta inacessível.
                    </div>
                  )}
                  {fileTree
                    .filter(item => explorerMode === 'files' || item.type === 'folder')
                    .map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 group">
                      <button 
                        onClick={() => {
                          if (item.type === 'folder') {
                            setCurrentBrowsingDir(`${currentBrowsingDir}${currentBrowsingDir.endsWith('\\') || currentBrowsingDir.endsWith('/') ? '' : (currentBrowsingDir.includes('\\') ? '\\' : '/')}${item.name}`);
                          } else if (explorerMode === 'files') {
                            handleFileSelect(item.name);
                          }
                        }}
                        className="flex items-center gap-3 flex-1 p-2 hover:bg-[#222] rounded text-left transition-colors"
                      >
                         {explorerMode === 'files' ? (
                            // Se for arquivo e estiver selecionado, mostra check
                            (item.type === 'file' && config.files.some((f: string) => f.split('/').pop() === item.name)) ? (
                              <CheckSquare size={16} className="text-orange-500" />
                            ) : (
                              item.type === 'folder' ? <FolderOpen size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-500" />
                            )
                         ) : (
                            <FolderOpen size={16} className="text-blue-400" />
                         )}
                         <span className={`font-mono text-sm flex-1 ${item.type === 'folder' ? 'text-blue-300' : 'text-gray-300'}`}>
                           {item.name}{item.type === 'folder' ? '/' : ''}
                         </span>
                      </button>
                      
                      {item.type === 'folder' && explorerMode === 'files' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileSelect(item.name);
                          }}
                          className={`p-2 rounded hover:bg-orange-500/20 text-xs font-bold transition-all ${
                            config.files.some((f: string) => f.split('/').pop() === item.name)
                            ? 'text-orange-500 bg-orange-500/10'
                            : 'text-gray-500 hover:text-orange-400'
                          }`}
                          title="Selecionar esta pasta inteira"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="p-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">
                    Modo: {explorerMode === 'files' ? 'Seleção de Arquivos' : 'Seleção de Pasta'}
                  </span>
                  <div className="flex gap-2">
                    {explorerMode === 'files' && fileTree.some(i => i.name === 'dist') && (
                      <button 
                        onClick={() => {
                          updateConfig({ files: ['dist'] });
                          setIsExplorerOpen(false);
                        }}
                        className="px-4 py-2 bg-orange-600/20 text-orange-500 border border-orange-500/30 hover:bg-orange-600/30 rounded-md text-sm font-medium transition-colors"
                      >
                        Apenas 'dist'
                      </button>
                    )}
                    <button 
                      onClick={() => setIsExplorerOpen(false)}
                      className="px-4 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        if (explorerMode === 'folder') {
                          updateConfig({ localPath: currentBrowsingDir });
                        }
                        setIsExplorerOpen(false);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg"
                    >
                      {explorerMode === 'folder' ? 'Selecionar esta Pasta' : 'Concluído'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* NEW PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-[#2a2a2a] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Plus className="text-emerald-500" size={24} /> Novo Projeto de Deploy
              </h3>
              <p className="text-gray-400 text-sm mb-6">Dê um nome para identificar este projeto.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Nome do Projeto</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
                    placeholder="Ex: Minha Loja Virtual" 
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#1a1a1a] border-t border-[#2a2a2a] flex justify-end gap-3">
              <button 
                onClick={() => { setIsNewProjectModalOpen(false); setNewProjectName(''); }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddProject}
                disabled={!newProjectName.trim()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/20"
              >
                Criar Projeto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-[#2a2a2a] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Excluir Projeto?</h3>
              <p className="text-gray-400 text-sm">
                Esta ação não pode ser desfeita. Todas as configurações deste projeto serão removidas permanentemente.
              </p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border-t border-[#2a2a2a] flex gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="flex-1 py-2.5 bg-[#222] hover:bg-[#333] text-gray-400 rounded-lg text-sm font-bold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={(e) => handleDeleteProject(projectToDelete, e)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-900/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

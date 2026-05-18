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
      onDeployLog: (callback: (log: any) => void) => void;
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
    runNpmInstall: true,
    notes: ''
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
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Terminal Simulation Logic
  useEffect(() => {
    const commands = [
      "[INFO] Verificando integridade dos pacotes...",
      "[OK] Dependências em conformidade.",
      "[SSH] Estabelecendo túnel seguro com node-01...",
      "[SEC] Criptografia AES-256 ativa.",
      "[INFO] Monitorando tráfego na porta 4006...",
      "[OK] Proxy reverso Apache respondendo em 12ms.",
      "[SYSTEM] Memória swap otimizada.",
      "[WARN] Tentativa de acesso não autorizado bloqueada: 192.168.1.45",
      "[INFO] Sincronizando repositórios locais...",
      "[OK] Cache de build atualizado.",
      "[PROCESS] PM2 monitorando 4 instâncias.",
      "[STATUS] Sistema operacional estável.",
      "[INFO] Verificando atualizações de kernel...",
      "[OK] Kernel 5.15.0-72-GENERIC é a versão mais recente.",
      "[NETWORK] Latência média: 45ms",
      "[STORAGE] Espaço em disco: 82% livre.",
      "[DEBUG] Ciclo de coleta de lixo finalizado.",
      "[OK] Heartbeat enviado para o painel central."
    ];

    let i = 0;
    const interval = setInterval(() => {
      setTerminalLogs(prev => {
        const next = [...prev, commands[i]];
        i = (i + 1) % commands.length;
        // Manter um histórico maior para o scroll ser suave
        if (next.length > 50) return next.slice(1);
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [terminalLogs]);
  const [expandedProjects, setExpandedProjects] = useState<string[]>(() => {
    const saved = localStorage.getItem('expandedProjects');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('expandedProjects', JSON.stringify(expandedProjects));
  }, [expandedProjects]);

  const toggleProjectExpand = (id: string) => {
    setExpandedProjects(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);


  // Fetch real file tree when explorer opens
  useEffect(() => {
    if (isExplorerOpen) {
      setIsExplorerLoading(true);
      setExplorerError(null);
      
      const dirToFetch = currentBrowsingDir || (explorerMode === 'files' ? config.localPath : '');
      
      const handleData = (data: any) => {
        setIsExplorerLoading(false);
        if (data.error) {
          setExplorerError(data.error);
          setFileTree([]);
          return;
        }

        if (data.files && Array.isArray(data.files)) {
          setFileTree(data.files);
          setCurrentBrowsingDir(data.currentDir);
          setParentBrowsingDir(data.parentDir);
        } else {
          setExplorerError("Resposta inválida do servidor");
          setFileTree([]);
        }
      };

      if (window.electronAPI) {
        window.electronAPI.listFiles(dirToFetch)
          .then(handleData)
          .catch(err => {
            setIsExplorerLoading(false);
            setExplorerError(err.message);
            setFileTree([]);
          });
      } else {
        fetch(`${API_BASE}/api/files?dir=${encodeURIComponent(dirToFetch)}`)
          .then(res => res.json())
          .then(handleData)
          .catch(err => {
            setIsExplorerLoading(false);
            setExplorerError(err.message);
            setFileTree([]);
          });
      }
    }
  }, [isExplorerOpen, currentBrowsingDir]);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const emoji = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    setLogs(prev => [...prev, `${emoji} ${msg}`]);
  };

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onDeployLog) {
      window.electronAPI.onDeployLog((log: any) => {
        addLog(log.message, log.type);
      });
    }
  }, []);

  const startSending = async () => {
    if (!selectedProject || config.files.length === 0) return;
    
    setLogs([]);
    addLog(`Iniciando deploy real: ${selectedProject.name}`, 'info');
    addLog(`Origem: ${config.localPath}`, 'info');
    addLog(`Destino: ${config.sshHost}:${config.destPath}`, 'info');
    
    setIsSending(true);

    try {
      addLog(`Preparando ${config.files.length} item(s)...`, 'info');
      
      const needsBuild = config.files.some(f => f.toLowerCase().includes('dist') || f.toLowerCase().includes('build'));
      if (needsBuild) {
        addLog(`⏳ Detectada pasta de build/dist. Iniciando build automático...`, 'info');
        addLog(`ℹ️ Verifique o terminal do backend para acompanhar o progresso real do npm run build.`, 'info');
      }
      
      let result;
      if (window.electronAPI) {
        result = await window.electronAPI.runDeploy({ config });
      } else {
        // Fallback para quando não estiver no Electron (via API)
        const response = await fetch(`${API_BASE}/api/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config })
        });
        result = await response.json();
        
        // Se houver log detalhado do backend e não estiver no Electron (onde já recebemos via stream), use-o
        if (result.log && Array.isArray(result.log)) {
          result.log.forEach((entry: any) => {
            addLog(entry.message, entry.type);
          });
        }
      }
      
      if (result.success) {
        addLog(`Deploy e movimentação finalizados com sucesso!`, 'success');
        updateConfig({ lastDeploy: new Date().toLocaleString() });
      } else {
        addLog(`Erro no processo: ${result.error}`, 'error');
      }
    } catch (err: any) {
      addLog(`Falha crítica: ${err.message}`, 'error');
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
        runNpmInstall: true,
        notes: ''
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
    <div className="flex h-screen w-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden font-sans select-none">
      
      {/* ACTIVITY BAR (VS CODE STYLE) */}
      <div className="w-[50px] bg-[#333333] flex flex-col items-center py-2 gap-0 border-r border-[#2b2b2b] shrink-0 z-30">
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="w-full p-3 text-gray-400 hover:text-white transition-colors flex justify-center mb-2"
          title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <Menu size={24} strokeWidth={1.5} />
        </button>

        <button 
          onClick={() => {
            if (activeTab === 'home') setIsSidebarCollapsed(!isSidebarCollapsed);
            else { setActiveTab('home'); setIsSidebarCollapsed(false); }
          }}
          className={`w-full p-3 transition-colors relative group flex justify-center ${activeTab === 'home' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          title="Home"
        >
          <HomeIcon size={24} strokeWidth={1.5} />
          {activeTab === 'home' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />}
        </button>

        <button 
          onClick={() => {
            if (activeTab === 'enviar') setIsSidebarCollapsed(!isSidebarCollapsed);
            else { setActiveTab('enviar'); setIsSidebarCollapsed(false); }
          }}
          className={`w-full p-3 transition-colors relative group flex justify-center ${activeTab === 'enviar' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          title="Deploy"
        >
          <Rocket size={24} strokeWidth={1.5} />
          {activeTab === 'enviar' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />}
        </button>

        <button 
          onClick={() => {
            if (activeTab === 'config') setIsSidebarCollapsed(!isSidebarCollapsed);
            else { setActiveTab('config'); setIsSidebarCollapsed(false); }
          }}
          className={`w-full p-3 transition-colors relative group flex justify-center ${activeTab === 'config' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          title="Configurações Globais"
        >
          <Settings size={24} strokeWidth={1.5} />
          {activeTab === 'config' && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />}
        </button>

        <div className="mt-auto flex flex-col w-full">
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className="w-full p-3 text-gray-500 hover:text-gray-300 transition-colors flex justify-center"
            title="Novo Projeto"
          >
            <Plus size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* SIDEBAR (EXPLORER STYLE) */}
      <motion.div 
        animate={{ width: isSidebarCollapsed ? 0 : 250 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="bg-[#252526] border-r border-[#2b2b2b] flex flex-col shrink-0 relative z-20 overflow-hidden"
      >
        <div className="h-10 px-4 flex items-center justify-between text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>Explorer</span>
          <div className="flex gap-1">
             <button onClick={() => setIsNewProjectModalOpen(true)} className="p-1 hover:bg-[#37373d] rounded transition-colors" title="Novo Projeto">
               <Plus size={16} />
             </button>
             <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 hover:bg-[#37373d] rounded transition-colors" title="Recolher Sidebar">
               <ChevronLeft size={16} />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* PROJETOS SECTION */}
          <div className="border-t border-[#2b2b2b]">
            <div className="bg-[#37373d]/30 h-7 px-1 flex items-center gap-1 text-[12px] font-bold text-white uppercase cursor-pointer hover:bg-[#37373d]/50">
              <ChevronRight size={16} className="rotate-90" />
              <span>Projetos</span>
            </div>
            
            <div className="py-1">
              {projects.map(p => (
                <div key={p.id} className="flex flex-col">
                  {/* Project Folder Item */}
                  <div 
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      toggleProjectExpand(p.id);
                    }}
                    className={`group flex items-center h-8 px-1 cursor-pointer transition-colors
                      ${selectedProjectId === p.id ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-gray-400 hover:text-gray-200'}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: expandedProjects.includes(p.id) ? 90 : 0 }}
                        transition={{ duration: 0.1 }}
                      >
                        <ChevronRight size={16} />
                      </motion.div>
                    </div>
                    <div className={`w-5 h-5 flex items-center justify-center mr-1.5 ${p.color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'}`}>
                      <FolderOpen size={16} fill="currentColor" fillOpacity={0.2} />
                    </div>
                    <span className="text-[14px] truncate flex-1 font-medium">{p.name}</span>
                    
                    {/* Delete button only on hover */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setProjectToDelete(p.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#454545] rounded text-gray-400 hover:text-red-400 transition-all mr-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Expanded Content (Files/Settings inside project) */}
                  <AnimatePresence>
                    {expandedProjects.includes(p.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-6 flex flex-col pb-1">
                          {/* Sub-item: Enviar */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(p.id);
                              setActiveTab('enviar');
                            }}
                            className={`flex items-center h-7 px-2 gap-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors text-[14px] w-full text-left
                              ${selectedProjectId === p.id && activeTab === 'enviar' ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:text-gray-200'}`}
                          >
                            <Rocket size={14} className="text-emerald-500" />
                            <span>Deploy</span>
                          </button>
                          
                          {/* Sub-item: Configuração */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(p.id);
                              setActiveTab('config');
                            }}
                            className={`flex items-center h-7 px-2 gap-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors text-[14px] w-full text-left
                              ${selectedProjectId === p.id && activeTab === 'config' ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:text-gray-200'}`}
                          >
                            <Settings size={14} className="text-gray-500" />
                            <span>Configuração</span>
                          </button>

                          {/* Sub-item: Anotações */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectId(p.id);
                              setActiveTab('anotacoes');
                            }}
                            className={`flex items-center h-7 px-2 gap-2 cursor-pointer hover:bg-[#2a2d2e] transition-colors text-[14px] w-full text-left
                              ${selectedProjectId === p.id && activeTab === 'anotacoes' ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:text-gray-200'}`}
                          >
                            <TerminalSquare size={14} className="text-yellow-500" />
                            <span>Anotações</span>
                          </button>

                          {/* Sub-item: Logs (Quick info) */}
                          <div className="flex items-center h-6 px-1 gap-2 text-[10px] text-gray-500 font-mono italic">
                            <Activity size={10} />
                            <span>{p.lastDeploy || 'Sem deploy'}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RE-OPEN SIDEBAR BUTTON (Floating when collapsed) */}
        {isSidebarCollapsed && (
          <button 
            onClick={() => setIsSidebarCollapsed(false)}
            className="absolute left-0 top-0 bottom-0 w-1 hover:bg-emerald-500/20 transition-colors z-50"
            title="Abrir Explorer"
          />
        )}
      </motion.div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        
        {/* HEADER (VS CODE TABS STYLE) */}
        <header className="h-9 bg-[#252526] flex items-center overflow-hidden shrink-0">
          <div className="flex h-full">
            <div 
              className={`px-3 flex items-center gap-2 text-[12px] h-full cursor-pointer transition-colors border-r border-[#1e1e1e] group
                ${activeTab === 'home' ? 'bg-[#1e1e1e] text-white border-t border-t-emerald-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2a2d2e]'}`}
              onClick={() => setActiveTab('home')}
            >
              <HomeIcon size={14} className="text-emerald-500" />
              <span>Dashboard</span>
            </div>

            {selectedProject && (
              <>
                <div 
                  className={`px-3 flex items-center gap-2 text-[12px] h-full cursor-pointer transition-colors border-r border-[#1e1e1e] group
                    ${activeTab === 'enviar' ? 'bg-[#1e1e1e] text-white border-t border-t-blue-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2a2d2e]'}`}
                  onClick={() => setActiveTab('enviar')}
                >
                  <Rocket size={14} className="text-blue-400" />
                  <span>Deploy: {selectedProject.name}</span>
                </div>

                <div 
                  className={`px-3 flex items-center gap-2 text-[12px] h-full cursor-pointer transition-colors border-r border-[#1e1e1e] group
                    ${activeTab === 'config' ? 'bg-[#1e1e1e] text-white border-t border-t-orange-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2a2d2e]'}`}
                  onClick={() => setActiveTab('config')}
                >
                  <Settings size={14} className="text-gray-400" />
                  <span>Config: {selectedProject.name}</span>
                </div>

                <div 
                  className={`px-3 flex items-center gap-2 text-[12px] h-full cursor-pointer transition-colors border-r border-[#1e1e1e] group
                    ${activeTab === 'anotacoes' ? 'bg-[#1e1e1e] text-white border-t border-t-yellow-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2a2d2e]'}`}
                  onClick={() => setActiveTab('anotacoes')}
                >
                  <TerminalSquare size={14} className="text-yellow-500" />
                  <span>Notes: {selectedProject.name}</span>
                </div>
              </>
            )}
          </div>
        </header>

        {/* BREADCRUMBS */}
        <div className="h-6 bg-[#1e1e1e] flex items-center px-4 text-[11px] text-gray-500 gap-2 border-b border-[#2b2b2b]/50">
          <span className="hover:text-gray-300 cursor-pointer">Projetos</span>
          {selectedProject && (
            <>
              <ChevronRight size={12} />
              <span className="hover:text-gray-300 cursor-pointer">{selectedProject.name}</span>
              <ChevronRight size={12} />
              <span className="text-gray-300 font-medium">
                {activeTab === 'home' ? 'Dashboard' : activeTab === 'enviar' ? 'Deploy' : activeTab === 'config' ? 'Configuração' : 'Anotações'}
              </span>
            </>
          )}
        </div>

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
                    Status do Sistema: Seguro
                  </div>
                  <h1 className="text-4xl font-black text-white flex items-baseline gap-2">
                    <span className="text-emerald-500">FF</span>_NÚCLEO <span className="text-xs text-gray-600 font-normal">v4.0.8-estável</span>
                  </h1>
                </div>
                <div className="text-[10px] text-gray-500 text-right space-y-0.5 mt-4 md:mt-0">
                  <p>SO: LINUX_NODE_X64</p>
                  <p>KERNEL: 5.15.0-72-GENERIC</p>
                  <p>IP_LOCAL: 127.0.0.1</p>
                  <p>HORÁRIO: {new Date().toLocaleString()}</p>
                </div>
              </div>

              {/* MAIN DASHBOARD GRID */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* LEFT COLUMN: NODE MONITOR */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                  <div className="bg-[#111] border border-[#222] rounded-lg p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                        <Wifi size={12} /> Nós Ativos
                      </h3>
                      <span className="text-[9px] text-gray-600">0{projects.length} online</span>
                    </div>
                    <div className="space-y-3">
                      {projects.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 group/item">
                          <div className={`w-1.5 h-1.5 rounded-full ${p.color === 'yellow' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-gray-300 font-bold truncate group-hover/item:text-emerald-400 transition-colors">{p.name}</div>
                            <div className="text-[9px] text-gray-600 font-mono">{p.config.sshHost}</div>
                          </div>
                          <div className="text-[9px] text-emerald-500 font-mono">2ms</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-[#222]">
                       <div className="text-[9px] text-gray-500 uppercase mb-2">Tráfego de Rede</div>
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
                      <Lock size={12} /> Protocolos de Autenticação
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">SSH_AUTH</span>
                        <span className="text-emerald-500">RSA_ATIVO</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">SSL_PROXY</span>
                        <span className="text-emerald-500">ATIVO</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">FIREWALL</span>
                        <span className="text-red-500/70">BYPASS</span>
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
                        <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase">Pronto para Deploy</h2>
                        <p className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest">Protocolos inicializados // Aguardando seleção de projeto</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('enviar')}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-xs tracking-[0.3em] rounded-sm transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                      >
                        Abrir_Terminal
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
                      { label: 'USO_CPU', value: '0.4%', icon: Cpu },
                      { label: 'MEM_ALOCADA', value: '1.2GB', icon: Database },
                      { label: 'DISCO_DISP', value: '450GB', icon: HardDrive },
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
                  <div className="bg-[#0c0c0c] border border-[#222] rounded-lg h-[450px] flex flex-col overflow-hidden relative">
                    <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between bg-[#111]">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Terminal size={12} /> Console_Ativo
                      </h3>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                    <div className="p-4 flex-1 font-mono text-[9px] leading-relaxed overflow-hidden bg-black/40 flex flex-col">
                       <div className="mb-4 text-emerald-500/60 leading-[8px] whitespace-pre shrink-0">
{`
    _   _   _   _   _   _  
   / \\ / \\ / \\ / \\ / \\ / \\ 
  ( D | E | P | L | O | Y )
   \\_/ \\_/ \\_/ \\_/ \\_/ \\_/ 
`}
                       </div>
                       
                       <div 
                         ref={terminalRef}
                         className="flex-1 overflow-y-auto space-y-0.5 scroll-smooth no-scrollbar"
                       >
                          {terminalLogs.map((log, idx) => (
                            <motion.p 
                              key={`${log}-${idx}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2 }}
                              className={`
                                ${log.includes('[OK]') ? 'text-emerald-500' : ''}
                                ${log.includes('[WARN]') ? 'text-yellow-500' : ''}
                                ${log.includes('[ERROR]') ? 'text-red-500' : ''}
                                ${log.includes('[SEC]') ? 'text-blue-400' : ''}
                                ${log.includes('[INFO]') ? 'text-gray-400' : ''}
                                ${log.includes('[SYSTEM]') || log.includes('[PROCESS]') ? 'text-purple-400' : ''}
                              `}
                            >
                              {log}
                            </motion.p>
                          ))}
                          <p className="animate-pulse text-emerald-500 mt-1">{"adr@sistema:~$ _"}</p>
                       </div>
                       
                       <div className="mt-6 pt-6 border-t border-[#222] space-y-4">
                          <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/10">
                             <div className="text-[8px] text-emerald-500 font-bold uppercase mb-2">Último Deployment</div>
                             <div className="text-[11px] text-white font-bold">{projects[0]?.name || 'N/A'}</div>
                             <div className="text-[9px] text-gray-600 mt-1">{projects[0]?.lastDeploy || 'Nunca'}</div>
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
                  {isSending && (
                    <div className="flex items-center gap-2 mt-2 text-blue-400 font-bold italic animate-pulse">
                      <span>Executando processo</span>
                      <span className="loading-dots"></span>
                    </div>
                  )}
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
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Caminho absoluto da pasta</label>
                      <input 
                        type="text" 
                        value={config.destPath} 
                        onChange={(e) => updateConfig({ destPath: e.target.value})} 
                        placeholder="/home/adriano-martins/" 
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono text-gray-200" 
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateConfig({ directUpload: !config.directUpload })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all text-xs font-medium ${
                          config.directUpload 
                          ? 'bg-purple-500/10 border-purple-500/50 text-purple-500' 
                          : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        {config.directUpload ? <CheckSquare size={14} /> : <Square size={14} />}
                        Enviar para Local Único (Direto para pasta final)
                      </button>
                    </div>

                    {!config.directUpload && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                        Os arquivos serão copiados temporariamente para esta pasta (ex: seu diretório home).
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#222]">
                    {!config.directUpload && (
                      <>
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
                      </>
                    )}
                    {((config.finalPath && !config.directUpload) || config.directUpload) && (
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

                <div className="overflow-y-auto max-h-80 p-2 space-y-1 bg-[#111] min-h-[200px] flex flex-col">
                  {isExplorerLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2">
                      <Loader2 size={24} className="animate-spin text-blue-500" />
                      <span className="text-xs uppercase tracking-widest">Lendo Diretório...</span>
                    </div>
                  )}

                  {!isExplorerLoading && explorerError && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <AlertCircle size={32} className="text-red-500 mb-2 opacity-50" />
                      <div className="text-red-400 text-sm font-bold mb-1">Erro de Acesso</div>
                      <div className="text-gray-500 text-[11px] font-mono break-all">{explorerError}</div>
                      <button 
                        onClick={() => setCurrentBrowsingDir('')}
                        className="mt-4 px-3 py-1 bg-[#222] hover:bg-[#333] text-gray-400 text-[10px] uppercase rounded transition-all"
                      >
                        Tentar Pasta Inicial
                      </button>
                    </div>
                  )}

                  {!isExplorerLoading && !explorerError && fileTree.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500">
                       <FileBox size={32} className="mb-2 opacity-20" />
                       <span className="text-sm">Esta pasta está vazia.</span>
                    </div>
                  )}

                  {!isExplorerLoading && !explorerError && fileTree
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

          {/* TAB: ANOTACOES (CMD STYLE) */}
          {activeTab === 'anotacoes' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto h-[calc(100vh-220px)] flex flex-col"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <TerminalSquare size={20} className="text-yellow-500" /> 
                  Terminal de Anotações: <span className="text-emerald-500 font-mono text-sm">{selectedProject?.name}</span>
                </h3>
              </div>

              <div className="flex-1 bg-[#050505] border border-[#2a2a2a] rounded-xl flex flex-col shadow-2xl overflow-hidden font-mono relative">
                {/* Header do CMD */}
                <div className="px-4 py-2 border-b border-[#222] flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest bg-[#0a0a0a]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-yellow-500/70">
                      <Terminal size={12} /> 
                      PROJECT_NOTES.BAT
                    </span>
                    <span className="text-gray-700">// STATUS: WRITABLE // ENCODING: UTF-8</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
                  </div>
                </div>

                {/* Área de Texto CMD Style */}
                <div className="flex-1 relative group bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
                  <div className="absolute left-4 top-4 text-emerald-500/50 pointer-events-none select-none font-bold">
                    { (config.notes || '').length > 0 ? "~$ " : "adr@deploy-manager:~$ " }
                  </div>
                  <textarea 
                    value={config.notes || ''}
                    onChange={(e) => updateConfig({ notes: e.target.value })}
                    spellCheck={false}
                    className={`w-full h-full bg-transparent p-4 text-[#cccccc] focus:outline-none resize-none leading-relaxed caret-emerald-500 selection:bg-emerald-500/30 font-mono text-sm transition-all duration-300 ${
                      (config.notes || '').length > 0 ? 'pl-[55px]' : 'pl-[235px]'
                    }`}
                    placeholder="Aguardando entrada de dados..."
                  />
                  
                  {/* Scanline Effect embutido na área de texto */}
                  <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_3px,4px_100%]" />
                  
                  {/* Decoração CMD */}
                  <div className="absolute bottom-4 right-4 text-[9px] text-gray-700 select-none flex gap-4">
                    <span>L:{ (config.notes || '').split('\n').length } C:{ (config.notes || '').length }</span>
                    <span className="animate-pulse">[READY]</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-4 italic text-center uppercase tracking-widest">
                Os dados são persistidos automaticamente no núcleo de configuração.
              </p>
            </motion.div>
          )}
        </main>

        {/* STATUS BAR (VS CODE STYLE) */}
        <footer className={`h-[22px] ${isSending ? 'bg-[#007acc]' : 'bg-[#007acc]'} flex items-center px-3 text-[12px] text-white shrink-0 z-30 transition-colors`}>
          <div className="flex items-center gap-3 h-full">
            <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer">
              <ShieldCheck size={14} />
              <span>SSH: {selectedProject?.config.sshHost || 'Disconnected'}</span>
            </div>
            {isSending && (
              <div className="flex items-center gap-1.5 px-2 h-full italic">
                <Loader2 size={12} className="animate-spin" />
                <span>Enviando arquivos...</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4 h-full">
             <div className="hover:bg-white/10 px-2 h-full cursor-pointer flex items-center gap-1">
               <Cpu size={12} />
               <span>4%</span>
             </div>
             <div className="hover:bg-white/10 px-2 h-full cursor-pointer flex items-center gap-1">
               <Database size={12} />
               <span>1.2GB</span>
             </div>
             <div className="hover:bg-white/10 px-2 h-full cursor-pointer">
               <span>UTF-8</span>
             </div>
             <div className="hover:bg-white/10 px-2 h-full cursor-pointer flex items-center gap-1">
               <Zap size={14} className="text-yellow-300" />
               <span>v4.0.8</span>
             </div>
          </div>
        </footer>
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

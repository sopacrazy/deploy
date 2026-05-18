const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getProjects: () => ipcRenderer.invoke('get-projects'),
    saveProjects: (projects) => ipcRenderer.invoke('save-projects', projects),
    listFiles: (dir) => ipcRenderer.invoke('list-files', dir),
    runDeploy: (config) => ipcRenderer.invoke('run-deploy', config),
    onDeployLog: (callback) => ipcRenderer.on('deploy-log', (event, value) => callback(value))
});

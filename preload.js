const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whoAreU', {
  list: () => ipcRenderer.invoke('system:list'),
});

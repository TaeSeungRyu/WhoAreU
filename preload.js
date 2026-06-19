const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whoAreU', {
  list: (opts) => ipcRenderer.invoke('system:list', opts || {}),
  onVisibility: (cb) => {
    ipcRenderer.on('whoAreU:visible', (_e, visible) => cb(!!visible));
  },
});

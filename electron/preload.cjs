const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose any IPC methods here if needed in the future
});

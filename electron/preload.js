const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('NOGGANG_EXPORT', {
  chooseExportFile: (defaultTitle) =>
    ipcRenderer.invoke('export:chooseFile', { defaultTitle }),

  exportBegin: (args) => ipcRenderer.invoke('export:begin', args),
  exportWriteFrame: (args) => ipcRenderer.invoke('export:writeFrame', args),
  exportWriteAudioWav: (args) => ipcRenderer.invoke('export:writeAudioWav', args),
  exportFinalize: (args) => ipcRenderer.invoke('export:finalize', args),
  exportCancel: (args) => ipcRenderer.invoke('export:cancel', args),
});

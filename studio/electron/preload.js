const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:open"),
  saveFile: (content) => ipcRenderer.invoke("dialog:save", content),
});

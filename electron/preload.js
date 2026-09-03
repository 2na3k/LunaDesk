// Minimal, safe preload bridge. Exposes only a tiny, explicit surface so the
// renderer can detect it is running inside the desktop shell.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("lunadesk", {
  desktop: true,
  platform: process.platform,
});

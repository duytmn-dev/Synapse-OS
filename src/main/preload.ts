import { contextBridge, ipcRenderer } from 'electron';
import { createSynapseAPI } from './PreloadBridge.ts';

contextBridge.exposeInMainWorld('synapse', createSynapseAPI(ipcRenderer));

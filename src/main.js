// src/main.js
// Punto de entrada: monta la consola, conecta los periféricos y arranca el bucle.

import './styles/console.css';
import { Capacitor } from '@capacitor/core';
import { ConsoleEngine } from './core/ConsoleEngine.js';
import { SoundChip } from './core/SoundChip.js';
import { InputManager } from './core/InputManager.js';
import { StorageManager } from './core/StorageManager.js';
import { Catalog99 } from './core/Catalog99.js';
import { PlatformBridge } from './core/PlatformBridge.js';

function boot() {
  const root = document.getElementById('console');
  const canvas = document.getElementById('lcd');
  const screen = document.getElementById('screen');
  const led = document.getElementById('power-led');
  const dpad = document.getElementById('dpad');
  const actionsZone = document.getElementById('actions');

  const storage = new StorageManager();
  const settings = storage.getSettings();
  const sound = new SoundChip({ volumeLevel: settings.volume });
  const input = new InputManager({ root, dpad, actionsZone, haptics: settings.haptics });
  const catalog = new Catalog99();
  const platform = new PlatformBridge();

  const engine = new ConsoleEngine({ canvas, screen, led, input, sound, storage, catalog, platform });
  engine.start();
  // Con `npm run dev` la consola queda a mano en la consola del navegador (y para las pruebas automáticas).
  if (import.meta.env.DEV) window.retropocket = engine;

  if (Capacitor.isNativePlatform()) {
    setupNative(engine, sound, input, platform);
  } else {
    registerServiceWorker();
  }
}

/** PWA: en la web publicada, guarda la app en caché para jugar sin conexión. */
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[RetroPocket] No se pudo registrar el service worker:', err);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Integración con Android: botón "atrás", pausa al pasar a segundo plano y pantalla completa al volver. */
async function setupNative(engine, sound, input, platform) {
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      const handled = engine.handleBackButton();
      if (!handled) App.exitApp();
    });
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        sound.resume();
        platform.reapply();
      } else {
        input.releaseAll();
        engine.pause();
        if (engine.progress.dirty) engine.progress.save();
        sound.suspend();
        platform.suspend();
      }
    });
  } catch (err) {
    console.warn('[RetroPocket] Plugin App no disponible:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

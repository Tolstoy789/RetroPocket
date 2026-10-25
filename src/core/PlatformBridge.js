// src/core/PlatformBridge.js
// Funciones que dependen de la plataforma (Android nativo o navegador):
//   - Pantalla siempre encendida mientras se juega (plugin Keep Awake; en la web usa la Screen Wake Lock API).
//   - Pantalla completa: en Android oculta la barra de estado y la de navegación (SystemBars de Capacitor 8);
//     en la web usa la Fullscreen API.
//   - Portapapeles para la copia de seguridad de récords, con alternativas cuando no hay permiso.
//   - Compartir una imagen (la tarjeta de puntuación): en Android la guarda en la caché de la app
//     (plugin Filesystem) y abre el menú de compartir del sistema (plugin Share); en la web usa la
//     Web Share API si admite archivos y, si no, descarga el PNG.

import { Capacitor, SystemBars } from '@capacitor/core';
import { localize } from './i18n.js';

export class PlatformBridge {
  constructor() {
    this.native = Capacitor.isNativePlatform();
    this.keepAwakePlugin = null;
    this.keepAwakeLoading = null;
    this.wantAwake = false;
    this.awake = false;
    this.wantFullscreen = false;
  }

  // ---------- Pantalla encendida ----------

  async _loadKeepAwake() {
    if (this.keepAwakePlugin) return this.keepAwakePlugin;
    if (!this.keepAwakeLoading) {
      this.keepAwakeLoading = import('@capawesome/capacitor-keep-awake')
        .then(async ({ KeepAwake }) => {
          const { isAvailable } = await KeepAwake.isAvailable();
          this.keepAwakePlugin = isAvailable ? KeepAwake : null;
          return this.keepAwakePlugin;
        })
        .catch(() => null);
    }
    return this.keepAwakeLoading;
  }

  /** Pide (o suelta) que la pantalla no se apague. Se puede llamar en cada cambio de estado. */
  setKeepAwake(enabled) {
    this.wantAwake = !!enabled;
    this._syncKeepAwake();
  }

  async _syncKeepAwake() {
    const plugin = await this._loadKeepAwake();
    if (!plugin) return;
    const want = this.wantAwake && !document.hidden;
    if (want === this.awake) return;
    this.awake = want;
    try {
      if (want) await plugin.keepAwake();
      else await plugin.allowSleep();
    } catch {
      this.awake = false;
    }
  }

  // ---------- Pantalla completa ----------

  /** Activa o desactiva la pantalla completa. En la web solo funciona tras un toque del usuario. */
  setFullscreen(enabled, { fromGesture = false } = {}) {
    this.wantFullscreen = !!enabled;
    if (this.native) {
      const call = enabled ? SystemBars.hide() : SystemBars.show();
      call.catch(() => {});
      return;
    }
    if (!fromGesture) return;
    try {
      if (enabled && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      } else if (!enabled && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Navegador sin Fullscreen API.
    }
  }

  /** Al volver de segundo plano Android puede mostrar otra vez las barras y la web suelta el bloqueo. */
  reapply() {
    if (this.native && this.wantFullscreen) SystemBars.hide().catch(() => {});
    this.awake = false;
    this._syncKeepAwake();
  }

  /** Al pasar a segundo plano. */
  suspend() {
    this.awake = false;
  }

  // ---------- Portapapeles ----------

  /** Copia texto. Devuelve true si se copió; si no hay permiso, muestra el texto para copiarlo a mano. */
  async copyText(text, manualLabel) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Sin permiso: se prueba el método clásico.
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) return true;
    } catch {
      // Tampoco funciona: queda el cuadro de diálogo.
    }
    window.prompt(manualLabel, text);
    return false;
  }

  /** Lee texto del portapapeles o, si no se puede, lo pide en un cuadro de diálogo. */
  async readText(manualLabel) {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) return text;
      }
    } catch {
      // Sin permiso de lectura (habitual en Android): se pide a mano.
    }
    return window.prompt(manualLabel, '') || '';
  }

  // ---------- Compartir ----------

  /**
   * Comparte el contenido de un canvas como PNG.
   * @param {HTMLCanvasElement} canvas
   * @param {string} fileName Nombre del archivo (por ejemplo, retropocket-07-12345.png).
   * @param {string} text Texto que acompaña a la imagen en la app de destino.
   * @returns {Promise<'shared'|'cancelled'|'downloaded'>}
   */
  async shareImage(canvas, fileName, text) {
    if (this.native) {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
      try {
        await Share.share({ files: [uri], text, dialogTitle: localize('Compartir puntuación', 'Share score') });
        return 'shared';
      } catch (err) {
        if (/cancel/i.test(String(err?.message || err))) return 'cancelled';
        throw err;
      }
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear el PNG'))), 'image/png');
    });
    const file = typeof File === 'function' ? new File([blob], fileName, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
        // Sin permiso para compartir (por ejemplo, sin gesto del usuario): se descarga.
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  }
}

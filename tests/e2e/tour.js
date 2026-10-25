// tests/e2e/tour.js
// Recorrido por todas las pantallas de la consola, dibujando cada estado posible (cada slot del menú,
// cada fila de Opciones con todos sus valores, cada tema, pista, logro, etapa de la carrera, mes de la
// racha, pantalla de fin de partida...). La prueba de idioma lo ejecuta dentro de la página (lo sirve
// Vite) con Gfx.textLog activo, y así reúne todos los textos que se pueden ver para comprobar que
// tienen traducción. Toca el estado de la consola por dentro y al acabar lo deja todo como estaba.

import { THEMES } from '/src/core/Themes.js';
import { ACHIEVEMENTS } from '/src/core/Achievements.js';
import { ACTIONS } from '/src/core/InputManager.js';
import { HUB_TABS } from '/src/core/HubScreen.js';
import { BOOT_SCENES, BOOT_DURATION } from '/src/core/BootScenes.js';
import { renderShareCard } from '/src/core/ShareCard.js';

/** Cambia métodos o propiedades de un objeto mientras dura fn y luego los devuelve. */
function patched(target, changes, fn) {
  const saved = Object.keys(changes).map((key) => [key, Object.getOwnPropertyDescriptor(target, key)]);
  for (const [key, value] of Object.entries(changes)) Object.defineProperty(target, key, { value, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    }
  }
}

export function tourScreens(e) {
  const g = e.gfx;
  const catalog = e.catalog;
  const slots = catalog.slots;
  const settings = { ...e.settings };
  const draw = (state, times = [0, 0.6]) => {
    e.state = state;
    for (const t of times) {
      e.time = t;
      e.stateTime = t + 1;
      e._render();
    }
  };
  const today = new Date();
  const day = catalog.dailyChallenge(today).day;
  const streaks = [
    { current: 0, best: 0, total: 0, playedToday: false, today: day, first: day },
    { current: 1, best: 4, total: 9, playedToday: true, today: day, first: '2026-01-05' },
    { current: 5, best: 5, total: 12, playedToday: false, today: day, first: '2026-01-05' }
  ];

  // Ajustes de mentira: los cambios no se guardan ni encienden la pantalla completa.
  patched(e, { updateSetting: (key, value) => ((e.settings = { ...e.settings, [key]: value }), e.settings), platform: null }, () => {
    // Arranque: las tres animaciones de principio a fin.
    for (const scene of BOOT_SCENES) {
      e.settings = { ...e.settings, boot: scene.id };
      e.bootScene = null;
      const times = [];
      for (let t = 0; t <= BOOT_DURATION; t += 0.25) times.push(t);
      e.state = 'boot';
      for (const t of times) {
        e.stateTime = t;
        e.time = t;
        e._render();
      }
    }
    e.bootScene = null;

    // Menú: las 100 posiciones, con y sin racha del desafío diario.
    e.state = 'menu';
    for (const streak of streaks) {
      patched(e.progress, { streakInfo: () => streak }, () => {
        for (let i = 0; i <= slots.length; i++) {
          e.menu.jumpTo(i);
          for (const t of [0, 0.6]) {
            e.menu.time = t;
            e._render();
          }
        }
      });
    }

    // Opciones: cada fila con todos sus valores (y la confirmación de BORRAR RECORDS).
    e.openOptions();
    const options = e.options;
    patched(e, { cycleTheme: () => {} }, () => {
      options.items.forEach((item, i) => {
        options.index = i;
        for (let k = 0; k < 5; k++) {
          draw('options');
          if (item.change) item.change(1);
        }
        options.confirmErase = true;
        draw('options');
        options.confirmErase = false;
      });
    });
    e.settings = { ...settings };

    // Galería de temas: cada tema con cada carcasa (también las bloqueadas).
    e.openThemes();
    for (let i = 0; i < THEMES.length; i++) {
      for (const unlocked of [false, true]) {
        patched(e.progress, { isShellUnlocked: () => unlocked, isUnlocked: () => unlocked }, () => {
          const shells = e.themeGallery.shells.length;
          for (let s = 0; s < Math.max(1, shells); s++) {
            draw('themes');
            if (shells > 1) e.themeGallery.handleAction({ action: ACTIONS.DOWN, pressed: true });
          }
        });
      }
      e.themeGallery.handleAction({ action: ACTIONS.RIGHT, pressed: true });
    }
    e.setTheme(settings.theme);

    // Jukebox: cada pista, con chip y beeper, y los avisos de sonido apagado.
    e.openJukebox();
    const jukebox = e.jukebox;
    for (let i = 0; i < jukebox.entries.length; i++) {
      jukebox.index = i;
      for (const beeper of [false, true]) {
        e.settings = { ...e.settings, beeper };
        draw('jukebox');
      }
      for (const sound of [{ muted: true }, { muted: false, musicLevel: 0, sfxLevel: 0 }]) patched(e.sound, sound, () => draw('jukebox'));
    }
    e.settings = { ...settings };

    // PREPARADO: los 99 slots, cada fila, 1 o 2 jugadores, favorito y las 5 velocidades.
    for (const slot of slots) {
      e.openLaunch(slot);
      const launch = e.launchScreen;
      for (let row = 0; row < 4; row++) {
        launch.index = row;
        launch.players = row === 2 ? 2 : 1;
        launch.favorite = row === 3;
        launch.speed = 1 + (slot.number % 5);
        draw('launch');
      }
    }

    // START en el menú: las cinco pestañas con sus estados.
    e.openHub('games');
    const hub = e.hub;
    for (const tab of HUB_TABS) {
      hub.tab = tab;
      draw('hub');
    }
    hub.tab = 'games';
    hub.items = [];
    draw('hub');
    hub.items = slots.slice(0, 20).map((slot, i) => ({ slot, favorite: i < 4 }));
    for (let i = 0; i < hub.items.length; i++) {
      hub.gameIndex = i;
      draw('hub');
    }
    hub.tab = 'career';
    for (const cleared of [0, 37, 99]) {
      const info = { cleared, total: 99, current: Math.min(99, cleared + 1), bosses: Math.floor(cleared / 10), finished: cleared >= 99 };
      patched(e.progress, { careerInfo: () => info }, () => {
        for (let stage = 1; stage <= 99; stage++) {
          hub.careerStage = stage;
          draw('hub');
        }
      });
    }
    hub.tab = 'achievements';
    for (const unlocked of [false, true]) {
      patched(e.progress, { isUnlocked: () => unlocked, unlockedOn: () => day }, () => {
        for (let i = 0; i < ACHIEVEMENTS.length; i++) {
          hub.achIndex = i;
          draw('hub');
        }
      });
    }
    hub.tab = 'streak';
    for (const streak of streaks) {
      patched(e.progress, { streakInfo: () => streak }, () => {
        const now = today.getFullYear() * 12 + today.getMonth();
        for (let m = now - 11; m <= now; m++) {
          hub.month = m;
          draw('hub');
        }
      });
    }
    hub.tab = 'stats';
    hub._buildStats();
    for (let s = 0; s < hub.statsRows.length; s++) {
      hub.statsScroll = s;
      draw('hub');
    }

    // Pantalla de atracción: logo, récords y galería de motores.
    for (const page of [0, 1, 2]) {
      e.attract.page = page;
      for (let t = 0; t < 7; t += 0.35) {
        e.attract.pageTime = t;
        e.attract.time = t;
        e.state = 'attract';
        e._render();
      }
    }

    // Partida: pausa, aviso de descanso, iniciales, fin de partida (normal, carrera y 2 jugadores)...
    const slot = slots[0];
    const daily = catalog.dailyChallenge(today);
    const boss = catalog.careerSlot(10);
    const stage = catalog.careerSlot(9);
    e.currentSlot = slot;
    for (const saved of [false, true]) {
      for (const breakNotice of [false, true]) {
        Object.assign(e, { saved, breakNotice });
        for (let i = 0; i < 3; i++) {
          e.pauseIndex = i;
          draw('paused');
        }
      }
    }
    Object.assign(e, { saved: false, breakNotice: false, pauseIndex: 0 });
    for (const isHighScore of [false, true]) {
      e.initials.begin({ rank: 2, score: 4321, isHighScore }, () => {});
      draw('initials');
    }
    const table = [{ name: 'ELI', score: 9000 }, { name: 'AAA', score: 500 }];
    const base = { score: 1200, level: 3, highScore: 9000, isHighScore: false, rank: 0, stars: 1, previousStars: 0, table, message: 'CHOQUE' };
    const careers = [
      { stage: 9, boss: false, need: 1, passed: true, finished: false, next: 10 },
      { stage: 10, boss: true, need: 2, passed: true, finished: false, next: 11 },
      { stage: 11, boss: false, need: 1, passed: true, finished: false, next: 12 },
      { stage: 10, boss: true, need: 2, passed: false, finished: false, next: 0 },
      { stage: 9, boss: false, need: 1, passed: false, finished: false, next: 0 },
      { stage: 99, boss: true, need: 2, passed: true, finished: true, next: 0 }
    ];
    const matches = [
      { round: 1, scores: [800], stars: [1], wins: [0, 0] },
      { round: 2, scores: [800, 900], stars: [1, 1], wins: [0, 1] },
      { round: 3, scores: [900, 900], stars: [1, 1], wins: [1, 1] }
    ];
    for (const won of [false, true]) {
      for (const isHighScore of [false, true]) {
        e.result = { ...base, won, isHighScore, rank: isHighScore ? 1 : 0 };
        draw('gameover', [0, 0.4]);
        for (const career of careers) {
          e.currentSlot = career.boss ? boss : stage;
          e.result = { ...base, won, isHighScore, career };
          draw('gameover', [0, 0.4]);
        }
        e.currentSlot = slot;
        for (const match of matches) {
          e.match = { ...match, slot };
          e.result = { ...base, won, isHighScore };
          draw('gameover', [0, 0.4]);
          e.turnBadge = 1;
          draw('playing');
        }
        e.match = null;
        e.turnBadge = 0;
      }
    }
    // La tarjeta de compartir dibuja la pantalla de la partida con su propio texto.
    for (const career of [null, careers[0], careers[5]]) {
      e.result = { ...base, isHighScore: !career, rank: career ? 0 : 2, career };
      renderShareCard(e);
    }
    e.result = null;

    // Carga, cartucho no insertado, RESET mantenido y modo demo.
    for (const s of [slot, daily, boss, stage]) {
      e.currentSlot = s;
      draw('loading', [0, 0.3, 0.6]);
      draw('nocart');
    }
    e.currentSlot = slot;
    e.resetHold = 0.3;
    draw('playing');
    e.resetHold = 0;
    draw('demo');

    // «Continuar» la partida guardada: normal, desafío y carrera, con 2 jugadores y la confirmación.
    for (const s of [slot, daily, boss, stage]) {
      for (const match of [null, { round: 2, scores: [700] }]) {
        e.resumeOffer = { saved: { score: 4321, level: 4, date: Date.now(), match }, slot: s };
        for (const confirm of [false, true]) {
          e.resumeConfirm = confirm;
          draw('resume');
        }
      }
    }
    e.resumeOffer = null;
    e.resumeConfirm = false;
    e.currentSlot = null;

    // Avisos de logro.
    for (const achievement of ACHIEVEMENTS) {
      e.banner = { achievement, time: 1 };
      draw('menu', [0]);
    }
    e.banner = null;
  });

  e.settings = { ...settings };
  e.applySettings();
  e.goToMenu();
}

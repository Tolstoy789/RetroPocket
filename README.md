# RetroPocket 99-in-1

Consola portátil virtual estilo *Brick Game* con **99 juegos** (10 motores × variantes de reglas), que funciona **100% offline** en el navegador y en Android.

- **11 temas con la misma lógica:** *Retro*, *Futurista*, *Cristal*, *Bolsillo*, *Fósforo ámbar*, *Arcade*, *Madera 80s*, *Vaporwave*, *OLED nocturno*, *Papel* y *Estacional* (cambia solo con la estación). Cada uno trae su carcasa, su pantalla y su sonido, y se eligen en una galería con vista previa.
- **Música chiptune** en bucle para el menú y **dos pistas por motor** (la segunda suena en los niveles pares y el cambio espera a que acabe la frase), con volúmenes separados para música y efectos.
- **Jukebox** (Opciones → *Jukebox*): las 21 pistas, los jingles de arranque y de temporada y las fanfarrias, con una pianola que marca la nota que suena y un analizador de 16 bandas.
- **Modo beeper** (Opciones → *Altavoz*): imita el altavoz piezo de las maquinitas de bolsillo, con una sola voz cuadrada, sin bajo ni eco y con los efectos cortando la música.
- **Efectos de pantalla** para todos los juegos: sacudida, destellos y partículas.
- **Estela de LCD:** los píxeles tardan unas centésimas en apagarse, como en las pantallas de cristal líquido y de fósforo de verdad (se puede quitar en Opciones → *Estela LCD*). Los temas de tubo (*Futurista*, *Fósforo ámbar* y *Arcade*) añaden líneas de barrido y un halo de brillo alrededor de las celdas encendidas.
- **Miniatura animada en el menú:** al pararte en un juego, al lado de su número se ve una partida en pequeño jugada por la IA del modo demo, con las reglas de ese slot.
- **Estrellas** (1-3 por slot), contador de juegos superados X/99 y **tabla top 5 con iniciales** en cada slot.
- **Desafío diario** (slot 00): un juego y un giro de reglas nuevos cada día, iguales para todos.
- **Pantalla PREPARADO** antes de cada juego: muestra los controles del motor y deja elegir **VELOCIDAD (1-5)** y **NIVEL inicial (1-9)**, como en las Brick Game originales. Más velocidad da más puntos (×1,25 por punto).
- **Favoritos y recientes:** marca juegos como favoritos y vuelve a ellos (o a los últimos que jugaste) con START desde el menú.
- **Modo carrera:** recorre las 99 etapas en orden; superar una (1 estrella) desbloquea la siguiente y cada 10 hay un **jefe** (velocidad 2 y 2 estrellas). Mapa de 10×10 con las etapas superadas, los jefes y el trofeo final.
- **Compartir puntuación como imagen:** START al terminar una partida crea una tarjeta PNG con la consola (su tema y su color de carcasa), la pantalla de la partida, los puntos y las estrellas, y abre el menú de compartir del móvil.
- **40 logros con vitrina:** 20 generales (estrellas, horas de juego, rachas, carrera, explorar los 10 motores...) y 2 por motor (*Cuatro de golpe*, *Festín*, *Jefe caído*...). Cada uno tiene su icono dibujado en la matriz LCD y suena una fanfarria propia al conseguirlo.
- **Racha del desafío diario:** días seguidos jugando el slot 00, calendario del mes con los días jugados y estrellas especiales a los 7 y 30 días.
- **Estadísticas:** tiempo jugado total y por motor, partidas, récords batidos, motor favorito y contadores acumulados (líneas, fantasmas, ladrillos, naves...).
- **Colores de carcasa desbloqueables:** 7 colores para la carcasa *Retro* (el último, *Platino*, al completar la carrera) y 4 tintes para la *Cristal*, como premio de algunos logros.
- **Block Drop con reglas modernas:** guardar pieza (A+B), 3 piezas siguientes, bolsa de 7 y giros con los empujes estándar.
- **Copia de seguridad:** Opciones → *Copiar récords* genera un código con récords, ajustes, favoritos, logros, racha, carrera y estadísticas; *Pegar récords* lo restaura en otro móvil.
- **Android a pantalla completa** (sin barras del sistema) y **pantalla siempre encendida** mientras juegas.
- **Tres animaciones de arranque** que se turnan solas cada 2 días: *Ladrillo clásico* (los ladrillos forman un «99»), *Neón synthwave* (sol a rayas y cuadrícula) y *Cartucho 99* (el cartucho encaja y presenta los 10 motores). Cada una con su jingle. En **Opciones → Arranque** puedes dejar *AUTO* o fijar una.
- **Modo demo / atracción:** tras 20 s sin tocar el menú, la consola muestra logo, récords, la galería de motores y partidas automáticas.
- **Menú de opciones:** tema (con galería), contraste, estela LCD, música, efectos, altavoz (chip o beeper), jukebox, vibración, sacudida, paleta para daltonismo, botones grandes, animación de arranque, demo, pantalla completa, pantalla encendida, copiar y pegar récords, y borrar récords.
- **PWA offline:** en la web se puede instalar y funciona sin conexión (iconos y service worker generados por código).
- Todo el arte se dibuja por código en `<canvas>` y CSS.
- Todo el sonido se sintetiza en tiempo real con Web Audio API (pulso, triangular y ruido 8-bit).
- Sin imágenes, fuentes ni audios externos.
- Vite para desarrollo web y CapacitorJS para el APK de Android.

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22 o superior | Desarrollo y build |
| Git | cualquiera | Control de versiones |
| JDK | 21 | Solo si compilas el APK en tu PC |
| Android Studio / SDK | API 35+ | Solo si compilas el APK en tu PC |

> Capacitor 8 requiere Java 21. Si solo usas GitHub Actions para generar el APK, no necesitas instalar Java ni Android Studio.

## 1. Crear el repositorio y hacer el primer commit

Primero crea un repositorio **vacío** en GitHub llamado `retropocket-99in1` (sin README ni .gitignore). Después, dentro de esta carpeta:

```bash
git init
git add .
git commit -m "Iteración 1: scaffolding y core engine"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/retropocket-99in1.git
git push -u origin main
```

## 2. Instalar dependencias y probar en el navegador

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (por defecto `http://localhost:5173`). Gracias a `--host`, también puedes abrir desde el celular la URL de red (`http://192.168.x.x:5173`) si está en la misma Wi-Fi.

Para una build de producción:

```bash
npm run build
npm run preview
```

## 3. Compilar el APK de Android

### Opción A: automático con GitHub Actions (recomendado)

Cada `git push` ejecuta `.github/workflows/android-apk.yml`, que:

1. Instala Node 22 y las dependencias.
2. Compila la web con Vite.
3. Instala Java 21 (el Android SDK ya viene en las máquinas de GitHub).
4. Crea el proyecto Android si no existe, le pone el icono de la app (`build/android-icons.js`) y ejecuta `npx cap sync android`.
5. Pone la versión (`versionName` de `package.json` y un `versionCode` que sube en cada compilación).
6. Firma el APK siempre con la misma clave y lo compila con Gradle.
7. Lo publica como *Artifact* descargable.

Para descargarlo: pestaña **Actions** del repositorio → la última ejecución de **Android APK** → sección **Artifacts** → `retropocket-99in1-debug-apk`. Descomprime el `.zip`, copia el `.apk` al celular e instálalo (hay que permitir "instalar apps de origen desconocido").

También puedes lanzarlo a mano desde **Actions → Android APK → Run workflow**.

#### Actualizar sin perder los récords

Android solo instala una versión encima de otra si las dos están firmadas con la misma clave; si no, hay que desinstalar, y al desinstalar se borran los récords. Desde la v0.7 el workflow firma siempre con la misma clave:

- La primera compilación en `main` genera la clave y la guarda en la caché de GitHub Actions; las siguientes la reutilizan.
- **El primer APK de la v0.7 hay que instalarlo desinstalando antes la versión anterior** (las anteriores tenían una clave distinta cada vez). Antes de desinstalar, guarda tus récords con *Opciones → Copiar récords* y restáuralos después con *Pegar récords*. A partir de ahí, cada APK nuevo se instala encima.
- GitHub borra una caché que no se usa en 7 días. Para que la clave no cambie nunca, guárdala como secreto del repositorio:

  ```bash
  keytool -genkeypair -keystore retropocket.keystore -storepass android -alias androiddebugkey \
    -keypass android -keyalg RSA -keysize 2048 -validity 18250 -dname "CN=Android Debug,O=Android,C=US"
  base64 -w0 retropocket.keystore   # en macOS: base64 -i retropocket.keystore
  ```

  Copia el texto que sale en **Settings → Secrets and variables → Actions → New repository secret** con el nombre `ANDROID_DEBUG_KEYSTORE`. El workflow lo usa automáticamente. No subas el archivo `.keystore` al repositorio.

### Opción B: en tu PC

```bash
npm install
npm run cap:add            # solo la primera vez (crea android/ y pone el icono)
npm run cap:sync           # build web + copiar a Android
cd android
./gradlew assembleDebug    # en Windows: gradlew.bat assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Con `npm run cap:open` se abre el proyecto en Android Studio.

> La carpeta `android/` está en `.gitignore`: el workflow la regenera en cada build. Si algún día necesitas personalizar el proyecto nativo (iconos, permisos), quítala del `.gitignore` y súbela al repositorio.

## Controles

| Acción | Táctil | Teclado | Mando |
|---|---|---|---|
| Mover | Cruceta (puedes deslizar el dedo) | Flechas / WASD | Cruceta / stick |
| A | Botón A | Z, J, Espacio | A / Y |
| B | Botón B | X, K | B / X |
| C (guardar pieza en Block Drop) | A y B a la vez (centro del óvalo) | C, L, Mayús | L1 / R1 |
| Start / Pausa | START | Enter, P | Start |
| Volumen (OFF / LOW / HIGH) | SOUND | M | Select |
| Volver al menú | RESET | Retroceso, Esc | Home |

**En el menú:** ◀ ▶ cambian de juego (00–99; el 00 es el desafío diario; a la derecha se ve una partida de muestra en miniatura), ▲ ▼ saltan al motor anterior/siguiente, A abre **PREPARADO**, B abre las **opciones** y START abre **juegos, carrera y logros** (ver abajo).

**PREPARADO:** ▲ ▼ eligen VELOCIDAD, NIVEL o FAVORITO, ◀ ▶ los cambian y A o START empiezan la partida. Se recuerda la última elección de cada motor. El desafío diario se juega directamente, sin cambios, para que sea igual para todos.

**Juegos y logros (START en el menú):** ◀ ▶ cambian de pestaña y B o START vuelven al menú.

| Pestaña | Qué hay | Controles |
|---|---|---|
| JUEGOS | Favoritos (♥) y últimos juegos jugados | ▲ ▼ eligen, A abre PREPARADO |
| CARRERA | Mapa de las 99 etapas (superadas, la siguiente y los jefes), etapas y jefes superados, y la meta de cada etapa | ▲ ▼ eligen etapa (las ya abiertas), A la juega |
| LOGROS | Vitrina con los 40 logros: icono, descripción, progreso, fecha y premio | ▲ ▼ recorren la vitrina |
| RACHA | Días seguidos con el desafío diario, mejor racha, estrellas de 7 y 30 días y calendario del mes | ▲ ▼ cambian de mes, A juega el desafío de hoy |
| DATOS | Tiempo jugado (total y por motor), partidas, estrellas, motor favorito y contadores | ▲ ▼ desplazan |

**Opciones:** ▲ ▼ eligen, ◀ ▶ (o A) cambian el valor, B vuelve. Todo se guarda al momento.

**RESET durante una partida:** mantenlo pulsado 0,7 s para volver al menú.

**Récord nuevo:** al entrar en el top 5 de un slot, ▲ ▼ cambian la letra, A pasa a la siguiente y START guarda.

**Fin de partida:** A juega otra vez, B vuelve al menú y START **comparte la puntuación** como imagen. En el modo carrera, A pasa a la etapa siguiente (o reintenta la que no se superó) y B vuelve al mapa de la carrera.

**En Android:** el botón "atrás" pausa el juego o vuelve al menú; la app se pausa sola al pasar a segundo plano.

## Ergonomía

Pensada para sesiones largas con una o dos manos:

- **Modo zurdo** (Opciones → Mano): la cruceta pasa a la derecha y A/B a la izquierda, en vertical y en horizontal.
- **Zonas táctiles generosas:** la cruceta responde aunque el pulgar caiga fuera del dibujo y permite deslizar entre direcciones sin levantar el dedo. En el óvalo de A/B se puede deslizar de un botón a otro, y el punto medio pulsa **A y B a la vez**.
- **RESET seguro:** en plena partida hay que mantenerlo 0,7 s (aparece una barra), así un roce no te saca del juego.
- **Repetición de la cruceta** lenta, normal o rápida, según tus reflejos.
- **Botones grandes**, **alto contraste**, **paleta para daltonismo**, y opciones para quitar **sacudidas**, **destellos** (también apaga el brillo y el barrido de los temas de tubo) y la **estela de LCD** si molestan a la vista.
- **Aviso de descanso** cada 30 minutos de juego (pausa la partida y recomienda estirar manos y vista).
- La partida se pausa sola al bloquear el móvil o cambiar de app, y el botón "atrás" de Android pausa en vez de salir.

## Temas visuales

Un tema es solo una "piel": `ConsoleEngine.setTheme()` cambia la carcasa, la pantalla y el sonido, y nada de la lógica de juego. En **Opciones → Tema**, ◀▶ cambia de tema al momento y **A** abre la **galería**: al moverte con ◀▶, la consola entera se viste con el tema (carcasa, pantalla y sonido); en *Retro* y *Cristal*, ▲▼ prueban los colores de carcasa; **A** lo guarda y **B** vuelve al que tenías.

| Tema | Carcasa | Pantalla | Sonido |
|---|---|---|---|
| Retro | Amarilla, botones rojos | LCD verde, celdas de ladrillo | Pulso 8-bit seco |
| Futurista | Oscura con bordes neón | Negro con celdas luminosas a color, halo y barrido suave | Con eco espacial |
| Cristal | Violeta translúcida con "circuitos" | LCD gris azulado, ladrillo | Pulso seco |
| Bolsillo | Gris claro, cruceta negra, botones granate | 4 tonos de verde oliva, bloques de píxel | Seco y más grave |
| Fósforo ámbar | Metal negro con tornillos | Ámbar con brillo, líneas de barrido y la estela más larga (fósforo) | Seco con un zumbido leve de fondo |
| Arcade | Madera negra con vinilo de rayas, botón rojo grande | Monitor a color con esquinas curvas y barrido | Eco corto de sala |
| Madera 80s | Imitación madera, franja naranja, botones cromados | LCD sepia, ladrillo | Pulso seco |
| Vaporwave | Degradado rosa y turquesa con rejilla | Celdas pastel luminosas | Con eco y un poco más lento |
| OLED nocturno | Negro puro sin adornos | Negro y rojo tenue (no deslumbra a oscuras) | Volumen a la mitad |
| Papel | Libreta de rayas | Tinta de bolígrafo sobre cuadrícula | Pulso seco |
| Estacional | Otoño (sep-nov), invierno (dic-feb), primavera (mar-may) o verano (jun-ago) | Paleta de la estación | Jingle de la estación al encender |

### Colores de carcasa

Algunos logros regalan un color nuevo de carcasa. En la galería se pueden ver todos, pero los bloqueados solo se guardan al conseguir su logro (la galería dice cuál).

| Carcasa | Color | Logro que lo desbloquea |
|---|---|---|
| Retro | Amarilla | De serie |
| Retro | Roja (con A y B azul marino) | Primera estrella |
| Retro | Azul | Explorador (juega a los 10 motores) |
| Retro | Verde | 30 estrellas |
| Retro | Blanca | Cien partidas |
| Retro | Negra | 100 estrellas |
| Retro | Dorada (con brillo metálico) | Los 99 (juega los 99 slots) |
| Retro | Platino (con brillo metálico frío) | Campeón (completa las 99 etapas de la carrera) |
| Cristal | Violeta | De serie |
| Cristal | Hielo | Racha de 7 |
| Cristal | Menta | Maratón (1 hora de juego) |
| Cristal | Fuego | Diez perfectos (3 estrellas en 10 slots) |
| Cristal | Humo | Racha de 30 |

La opción **Daltonismo** cambia los colores de los temas a color (Futurista, Arcade, Vaporwave, Papel y Estacional) por una paleta Okabe-Ito distinguible con protanopía y deuteranopía. **Botones grandes** agranda la cruceta y los botones táctiles.

Los juegos dibujan con nombres de color (`'ink'`, `'cyan'`, `'red'`...) y con `gfx.cell()`; cada tema decide cómo se ven. Los temas están en `src/core/Themes.js`: paleta, estilo de celda (`brick`, `neon`, `solid` o `sketch`), timbre de `SoundChip`, rótulos de la carcasa, `ghost` (segundos que tarda en apagarse un píxel; 0 = sin estela) y, en los temas de tubo, `crt` (`scan` = intensidad del barrido, `bloom` = intensidad del halo). Si un motor necesita dibujar distinto según la pantalla, puede mirar `gfx.palette.colorful` (los colores se distinguen entre sí) y `gfx.palette.dark` (fondo oscuro). La carcasa se controla con los atributos `data-skin`, `data-season` y `data-shell` de `<html>` en `console.css`.

La estela y el brillo no tocan los motores: el juego dibuja cada fotograma en su buffer de 144×192 como siempre y `ConsoleEngine` lo compone al pasarlo a la pantalla. Para la estela guarda una segunda imagen que se acerca al fotograma nuevo con una caída exponencial (los píxeles que se encienden lo hacen al momento y los que se apagan se desvanecen en unos 100 ms). El halo es el mismo fotograma desenfocado y sumado con mezcla `lighter`, y las líneas de barrido se pintan alineadas con cada fila de píxeles del LCD.

## Logros, racha y estadísticas

`src/core/Progress.js` lleva las estadísticas, los logros y la racha. La consola le avisa del inicio y el fin de cada partida y del tiempo jugado (sin contar la pausa ni el modo demo), y los motores le envían sus contadores con dos llamadas de `BaseCartridge`:

- `this.track('lines', 4)` suma a un contador (en la partida y en el total).
- `this.peak('kmh', 180)` guarda una mejor marca.

Los logros están en `src/core/Achievements.js`: cada uno mira una estadística (`games`, `stars`, `streak`, `total:lines`, `best:kmh`...) y se desbloquea al llegar a su meta. Todo se guarda en `localStorage` con `saveExtra()`, así que entra en la copia de seguridad. La racha cuenta los días en que terminas el desafío diario y sigue viva hasta el final del día siguiente.

## Modo carrera

Las 99 etapas son los 99 slots en orden. Una etapa se supera con **1 estrella**; los **jefes** (etapas 10, 20... 90 y 99) se juegan a **velocidad 2** y piden **2 estrellas**. Superar la siguiente etapa pendiente abre la otra, y las ya superadas se pueden repetir cuando quieras. Los puntos cuentan también para los récords del slot. El avance se guarda con `saveExtra('career')`, así que entra en la copia de seguridad. Logros de la carrera: *Primer jefe* (etapa 10), *Media carrera* (50 etapas) y *Campeón* (las 99, que regala la carcasa Retro Platino).

## Compartir puntuación

START en la pantalla de fin de partida dibuja con `<canvas>` una tarjeta PNG de 720×1040: la consola con el tema y el color de carcasa que estés usando (los colores se leen de las variables CSS del tema), la última imagen de la partida con un panel de puntos, estrellas, nivel y fecha, y la marca. En Android se guarda en la caché de la app (`@capacitor/filesystem`) y se abre el menú de compartir del sistema (`@capacitor/share`); en la web se usa la Web Share API y, si el navegador no comparte archivos, se descarga el PNG. Todo se hace en el móvil, sin servidor.

## Música y sonido

Todo el sonido sale de `SoundChip.js` con Web Audio: pulsos de 12,5 %, 25 % y 50 %, triangular y ruido de 8 bits. Las pistas de `MUSIC_TRACKS` son texto: 32 corcheas por línea para la melodía, el bajo y la batería (`k` bombo, `s` caja, `h` charles). Cada motor tiene su pista (`blockdrop`) y una segunda (`blockdrop_b`); `trackFor(motor, nivel)` elige la de los niveles impares o pares, y durante la partida `queueMusic()` hace el cambio al empezar la siguiente mitad del bucle para no cortar la frase.

El **modo beeper** pasa todo a onda cuadrada, deja una sola voz (la música pierde el bajo y la batería se vuelve chasquidos; de las voces de un efecto que se pisan solo suena la primera), quita el eco y el zumbido del tema y manda la salida por un filtro que imita un altavoz piezo (sin graves y con una resonancia hacia 3 kHz). Como en las maquinitas de verdad, mientras suena un efecto la música se calla.

El **jukebox** (Opciones → *Jukebox*) toca las pistas en bucle y los jingles una vez. ▲▼ eligen, A toca o para, ◀▶ cambia entre chip y beeper para compararlos y B vuelve. La pianola marca el paso que se oye (`musicPosition()`) y el analizador lee un `AnalyserNode` (`spectrum()`).

## Estructura

```text
retropocket-99in1/
├── .github/workflows/android-apk.yml   # Compila el APK en cada push
├── public/manifest.json                # Metadatos PWA
├── src/
│   ├── core/
│   │   ├── ConsoleEngine.js   # Bucle de paso fijo, estados, canvas, Gfx y efectos (FxLayer)
│   │   ├── SoundChip.js       # Sintetizador 8-bit, música en bucle (2 pistas por motor) y modo beeper
│   │   ├── InputManager.js    # Multitáctil, teclado, mandos y vibración
│   │   ├── StorageManager.js  # Récords (top 5 con iniciales), ajustes y datos extra en localStorage
│   │   ├── Catalog99.js       # Los 99 slots, estrellas, desafío diario, etapas de la carrera y menú
│   │   ├── MenuPreview.js     # Miniatura animada del juego elegido en el menú (IA del modo demo)
│   │   ├── Themes.js          # Los 11 temas (paletas, celdas, sonido, rótulos) y colores de carcasa
│   │   ├── ThemeGallery.js    # Galería de temas y carcasas con vista previa
│   │   ├── Jukebox.js         # Jukebox: pistas, jingles y fanfarrias con pianola y analizador
│   │   ├── Progress.js        # Estadísticas, logros, racha del desafío diario y avance de la carrera
│   │   ├── Achievements.js    # Los 40 logros: meta, icono y descripción
│   │   ├── HubScreen.js       # START en el menú: JUEGOS, CARRERA, LOGROS, RACHA y DATOS
│   │   ├── ShareCard.js       # Tarjeta PNG para compartir una puntuación
│   │   ├── Screens.js         # Opciones, iniciales de récord y modo atracción/demo
│   │   ├── LaunchScreens.js   # PREPARADO (velocidad, nivel, controles y favorito)
│   │   ├── PlatformBridge.js  # Pantalla encendida, pantalla completa, portapapeles y compartir imagen
│   │   └── BootScenes.js      # Las 3 animaciones de arranque y su turno de 2 días
│   ├── games/
│   │   └── BaseCartridge.js   # Clase base de todos los motores
│   ├── styles/console.css     # Carcasa, cruceta, botones y pantalla
│   └── main.js                # Punto de entrada
├── build/pwa-plugin.js                 # Genera iconos PNG y service worker al compilar
├── capacitor.config.json
├── index.html
├── package.json
└── vite.config.js
```

## Mapa de los 99 juegos

| Slots | Motor | Archivo |
|---|---|---|
| 01–12 | Block Drop (bloques que caen) | `src/games/BlockDrop.js` |
| 13–22 | Maze Muncher (laberinto come-puntos) | `src/games/MazeMuncher.js` |
| 23–32 | Cyber Snake (serpiente) | `src/games/CyberSnake.js` |
| 33–42 | Brick Breaker (rompe-ladrillos) | `src/games/BrickBreaker.js` |
| 43–52 | Road Racer (autos en carriles) | `src/games/RoadRacer.js` |
| 53–62 | Tank Battle (tanques) | `src/games/TankBattle.js` |
| 63–72 | Space Shooter (naves) | `src/games/SpaceShooter.js` |
| 73–82 | Frog Crossing (cruzar la calle) | `src/games/FrogCrossing.js` |
| 83–91 | Flappy Pixel (esquivar obstáculos) | `src/games/FlappyPixel.js` |
| 92–99 | Memory Matrix (memoria y reflejos) | `src/games/MemoryMatrix.js` |

### Motores disponibles

| Motor | Estado | Controles |
|---|---|---|
| Block Drop | ✅ 12 variantes | ◀ ▶ mover, ▼ bajar rápido, ▲ caída instantánea, A girar, B girar al revés, A+B (o C) guardar pieza |
| Maze Muncher | ✅ 10 variantes | Cruceta (puedes pulsar el giro antes de llegar al cruce) |
| Cyber Snake | ✅ 10 variantes | Cruceta para girar, mantener A para acelerar |
| Brick Breaker | ✅ 10 variantes | ◀ ▶ mover la paleta (▲ la acelera), A lanzar la bola |
| Road Racer | ✅ 10 variantes | ◀ ▶ cambiar de carril, ▲ acelerar, ▼ frenar, A disparar (ARMADO) |
| Tank Battle | ✅ 10 variantes | Cruceta para moverte, A disparar |
| Space Shooter | ✅ 10 variantes | ◀ ▶ mover la nave, A disparar |
| Frog Crossing | ✅ 10 variantes | Cruceta: un salto por pulsación |
| Flappy Pixel | ✅ 9 variantes | A o ▲ aletear |
| Memory Matrix | ✅ 8 variantes | Cruceta para pulsar los botones; en matriz y parejas, cruceta mover y A elegir |

Los 99 slots ya tienen juego. Cada motor trae su propia IA para el modo demo, y todos respetan el giro **contrarreloj** del desafío diario (`sessionTime`, gestionado por `BaseCartridge`). En Frog Crossing y Memory Matrix, `timeLimit` es el tiempo de cada rana o de cada respuesta, no de la partida.

Las variantes de cada motor y todas las claves de `variantConfig` están documentadas en `src/core/Catalog99.js`. Si un motor no existiera en `src/games/`, sus slots aparecerían como **PRÓXIMAMENTE** en el menú; en cuanto se añade el archivo, Vite lo detecta automáticamente.

## Cómo crear un motor de juego

Cada motor es un archivo en `src/games/` que exporta por defecto una clase que hereda de `BaseCartridge`:

```js
import { BaseCartridge, ACTIONS } from './BaseCartridge.js';

export default class CyberSnake extends BaseCartridge {
  reset() {
    // this.config contiene el variantConfig del slot (speed, walls, obstacles...)
  }

  update(dt) {
    // lógica con paso fijo de 1/60 s
  }

  draw(gfx) {
    // gfx.clear(), gfx.cell(), gfx.text(), gfx.sprite(), this.drawHud()...
  }

  onInput({ action, pressed, repeat }) {
    if (pressed && action === ACTIONS.A) this.sound.sfx('shoot');
  }
}
```

Utilidades disponibles en `BaseCartridge`: `addScore()`, `loseLife()`, `levelUp()`, `gameOver()`, `win()`, `after()`, `every()`, `random()`, `randInt()`, `pick()`, `chance()`, `drawGrid()`, `drawHud()`, `isDown()`, las estadísticas `track()` y `peak()` y los efectos `shake()`, `flash()` y `burst()`. Para el modo demo, cada motor puede sobrescribir `autopilot(dt)` con su propia IA (por defecto pulsa botones al azar). Usa siempre `this.rng` / `this.random()` para el azar: así el desafío diario es igual para todos. La pantalla lógica mide **144 × 192** píxeles y se escala de forma nítida a cualquier tamaño.

## Licencia

MIT. Todos los nombres de juegos son genéricos y no hacen referencia a marcas registradas.

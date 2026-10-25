# Informe de dificultad

Generado con `npm run difficulty`: 40 partidas por slot jugadas por la IA del modo demo, con un tope de 180 s de juego cada una.

- **Puntos**: media geométrica de las partidas. **Aguanta**: mediana de los segundos jugados.
- **Relación**: puntos de la variante divididos por los de la primera variante del motor.
- **Propuesta**: multiplicador para las metas de estrellas (relación^0,6 entre ×0,4 y ×2; en las variantes rápidas nunca más de ×1).
- **Metas**: lo que usa hoy el slot (`stars` en Catalog99.js) y las puntuaciones de 1, 2 y 3 estrellas.

## Resumen

- Variantes casi imposibles para la IA (pierde todas antes de 25 s): 17 MAZE MUNCHER CAZADORES, 20 MAZE MUNCHER UNA VIDA. Sus metas están rebajadas.
- Ajustes a mano: 11 (ver al final).
- Metas que no siguen la propuesta sin estar en los ajustes a mano: ninguna.

## BLOCK DROP (metas del motor 1000 / 5000 / 15000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 01 | CLASICO | 125993 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 1000 / 5000 / 15000 |
| 02 | TURBO | 125145 | 0.99 | 180 s | 0 % | 0 % | ×1 | ×1: 1000 / 5000 / 15000 |
| 03 | NIVEL 5 | 190938 | 1.52 | 180 s | 0 % | 0 % | ×1.25 | ×1.25: 1300 / 6300 / 19000 |
| 04 | BASURA | 127984 | 1.02 | 180 s | 3 % | 0 % | ×1 | ×1: 1000 / 5000 / 15000 |
| 05 | MAREA | 139009 | 1.10 | 180 s | 0 % | 0 % | ×1 | ×1: 1000 / 5000 / 15000 |
| 06 | MINI | 65023 | 0.52 | 180 s | 0 % | 0 % | ×0.7 | ×0.7: 700 / 3500 / 11000 |
| 07 | PENTA | 9499 | 0.08 | 51 s | 100 % | 0 % | ×0.4 | ×0.4: 400 / 2000 / 6000 |
| 08 | INVISIBLE | 125993 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×0.7 (a mano): 700 / 3500 / 11000 |
| 09 | SPRINT 40 | 13060 | 0.10 | 56 s | 0 % | 100 % | ×0.4 | [1000, 4000, 8000] (a mano): 1000 / 4000 / 8000 |
| 10 | ESPEJO | 125993 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×0.8 (a mano): 800 / 4000 / 12000 |
| 11 | CASCADA | 124962 | 0.99 | 180 s | 0 % | 0 % | ×1 | ×1: 1000 / 5000 / 15000 |
| 12 | CAOS | 138176 | 1.10 | 180 s | 0 % | 0 % | ×1 | ×0.7 (a mano): 700 / 3500 / 11000 |

## MAZE MUNCHER (metas del motor 2000 / 8000 / 20000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 13 | CLASICO | 2680 | 1.00 | 70 s | 100 % | 0 % | ×1 | ×1: 2000 / 8000 / 20000 |
| 14 | RAPIDO | 6308 | 2.35 | 85 s | 100 % | 0 % | ×1 | ×1: 2000 / 8000 / 20000 |
| 15 | CRUZ | 4137 | 1.54 | 87 s | 100 % | 0 % | ×1.25 | ×1.25: 2500 / 10000 / 25000 |
| 16 | ESPIRAL | 2369 | 0.88 | 64 s | 95 % | 0 % | ×1 | ×1: 2000 / 8000 / 20000 |
| 17 | CAZADORES | 290 | 0.11 | 17 s | 100 % | 0 % | ×0.4 | ×0.4: 800 / 3200 / 8000 |
| 18 | POCO PODER | 1496 | 0.56 | 50 s | 100 % | 0 % | ×0.7 | ×0.7: 1400 / 5600 / 14000 |
| 19 | APAGON | 2680 | 1.00 | 70 s | 100 % | 0 % | ×1 | ×0.7 (a mano): 1400 / 5600 / 14000 |
| 20 | UNA VIDA | 432 | 0.16 | 16 s | 100 % | 0 % | ×0.4 | ×0.4: 800 / 3200 / 8000 |
| 21 | TRANQUILO | 11152 | 4.16 | 180 s | 3 % | 0 % | ×2 | ×2: 4000 / 16000 / 40000 |
| 22 | MARATON | 2918 | 1.09 | 70 s | 100 % | 0 % | ×1 | ×1: 2000 / 8000 / 20000 |

## CYBER SNAKE (metas del motor 300 / 1000 / 2500)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 23 | CLASICO | 11950 | 1.00 | 169 s | 57 % | 0 % | ×1 | ×1: 300 / 1000 / 2500 |
| 24 | SIN BORDES | 22155 | 1.85 | 180 s | 15 % | 0 % | ×1.5 | ×1.5: 450 / 1500 / 3800 |
| 25 | RAPIDO | 16398 | 1.37 | 120 s | 83 % | 0 % | ×1 | ×1: 300 / 1000 / 2500 |
| 26 | ACELERA | 17456 | 1.46 | 113 s | 90 % | 0 % | ×1 | ×1: 300 / 1000 / 2500 |
| 27 | BLOQUES | 14655 | 1.23 | 180 s | 40 % | 0 % | ×1.25 | ×1.25: 380 / 1300 / 3100 |
| 28 | LABERINTO | 12227 | 1.02 | 180 s | 48 % | 0 % | ×1 | ×1: 300 / 1000 / 2500 |
| 29 | GLOTON | 1656 | 0.14 | 135 s | 73 % | 0 % | ×0.4 | ×0.4: 120 / 400 / 1000 |
| 30 | BANQUETE | 13448 | 1.13 | 110 s | 93 % | 0 % | ×1 | ×1: 300 / 1000 / 2500 |
| 31 | RELOJ | 10171 | 0.85 | 90 s | 5 % | 95 % | ×1 | ×1: 300 / 1000 / 2500 |
| 32 | EXTREMO | 7505 | 0.63 | 90 s | 73 % | 0 % | ×0.8 | ×0.8: 240 / 800 / 2000 |

## BRICK BREAKER (metas del motor 1500 / 5000 / 12000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 33 | CLASICO | 4818 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 34 | PIRAMIDE | 4783 | 0.99 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 35 | FORTALEZA | 4744 | 0.98 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 36 | RAPIDO | 7666 | 1.59 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 37 | MINI PALA | 4357 | 0.90 | 180 s | 0 % | 0 % | ×1 | ×0.8 (a mano): 1200 / 4000 / 9600 |
| 38 | MULTIBOLA | 5720 | 1.19 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 39 | SIN AYUDAS | 3093 | 0.64 | 180 s | 0 % | 0 % | ×0.8 | ×0.8: 1200 / 4000 / 9600 |
| 40 | DIAMANTE | 4501 | 0.93 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 41 | INVASION | 5508 | 1.14 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |
| 42 | ACERO | 4024 | 0.84 | 180 s | 0 % | 0 % | ×1 | ×1: 1500 / 5000 / 12000 |

## ROAD RACER (metas del motor 2000 / 6000 / 15000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 43 | CLASICO | 2151 | 1.00 | 121 s | 100 % | 0 % | ×1 | ×1: 2000 / 6000 / 15000 |
| 44 | RAPIDO | 1862 | 0.87 | 94 s | 100 % | 0 % | ×1 | ×1: 2000 / 6000 / 15000 |
| 45 | ATASCO | 884 | 0.41 | 64 s | 100 % | 0 % | ×0.6 | ×0.6: 1200 / 3600 / 9000 |
| 46 | 5 CARRILES | 2167 | 1.01 | 125 s | 98 % | 0 % | ×1 | ×1: 2000 / 6000 / 15000 |
| 47 | GASOLINA | 1287 | 0.60 | 93 s | 100 % | 0 % | ×0.7 | ×0.7: 1400 / 4200 / 11000 |
| 48 | NOCHE | 2151 | 1.00 | 121 s | 100 % | 0 % | ×1 | ×0.8 (a mano): 1600 / 4800 / 12000 |
| 49 | CONTRAMANO | 672 | 0.31 | 55 s | 100 % | 0 % | ×0.5 | ×0.5: 1000 / 3000 / 7500 |
| 50 | ARMADO | 7192 | 3.34 | 180 s | 0 % | 0 % | ×2 | ×2: 4000 / 12000 / 30000 |
| 51 | CRUCERO | 1673 | 0.78 | 180 s | 0 % | 0 % | ×0.8 | ×0.8: 1600 / 4800 / 12000 |
| 52 | EXTREMO | 517 | 0.24 | 43 s | 100 % | 0 % | ×0.4 | ×0.4: 800 / 2400 / 6000 |

## TANK BATTLE (metas del motor 1000 / 4000 / 10000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 53 | CLASICO | 10888 | 1.00 | 95 s | 90 % | 0 % | ×1 | ×1: 1000 / 4000 / 10000 |
| 54 | HORDA | 3254 | 0.30 | 63 s | 100 % | 0 % | ×0.5 | ×0.5: 500 / 2000 / 5000 |
| 55 | ACERO | 9656 | 0.89 | 93 s | 95 % | 0 % | ×1 | ×1: 1000 / 4000 / 10000 |
| 56 | BOSQUE | 5499 | 0.51 | 71 s | 100 % | 0 % | ×0.7 | ×0.7: 700 / 2800 / 7000 |
| 57 | VELOCES | 1573 | 0.14 | 33 s | 100 % | 0 % | ×0.4 | ×0.4: 400 / 1600 / 4000 |
| 58 | FRANCOTIRO | 4541 | 0.42 | 54 s | 100 % | 0 % | ×0.6 | ×0.6: 600 / 2400 / 6000 |
| 59 | SUPERVIVE | 3097 | 0.28 | 52 s | 100 % | 0 % | ×0.5 | ×0.5: 500 / 2000 / 5000 |
| 60 | ARENA | 2918 | 0.27 | 42 s | 100 % | 0 % | ×0.5 | ×0.5: 500 / 2000 / 5000 |
| 61 | LABERINTO | 6359 | 0.58 | 63 s | 93 % | 0 % | ×0.7 | ×0.7: 700 / 2800 / 7000 |
| 62 | GUERRA | 1043 | 0.10 | 30 s | 100 % | 0 % | ×0.4 | ×0.4: 400 / 1600 / 4000 |

## SPACE SHOOTER (metas del motor 1500 / 6000 / 15000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 63 | INVASORES | 1405 | 1.00 | 70 s | 98 % | 0 % | ×1 | ×1: 1500 / 6000 / 15000 |
| 64 | INVASORES+ | 1033 | 0.74 | 66 s | 98 % | 0 % | ×0.8 | ×0.8: 1200 / 4800 / 12000 |
| 65 | SIN ESCUDOS | 7591 | 5.40 | 133 s | 80 % | 0 % | ×2 | ×1 (a mano): 1500 / 6000 / 15000 |
| 66 | GALAXIA | 1586 | 1.13 | 47 s | 100 % | 0 % | ×1 | ×1: 1500 / 6000 / 15000 |
| 67 | PICADA | 2212 | 1.57 | 73 s | 98 % | 0 % | ×1.25 | ×1.25: 1900 / 7500 / 19000 |
| 68 | DOBLE TIRO | 3257 | 2.32 | 68 s | 100 % | 0 % | ×1.5 | ×1.5: 2300 / 9000 / 23000 |
| 69 | METEOROS | 1621 | 1.15 | 180 s | 28 % | 0 % | ×1 | ×1: 1500 / 6000 / 15000 |
| 70 | JEFE | 927 | 0.66 | 69 s | 100 % | 0 % | ×0.8 | ×0.8: 1200 / 4800 / 12000 |
| 71 | LLUVIA | 1000 | 0.71 | 64 s | 98 % | 0 % | ×0.8 | ×0.8: 1200 / 4800 / 12000 |
| 72 | OLEADAS | 4515 | 3.21 | 72 s | 100 % | 0 % | ×2 | ×2: 3000 / 12000 / 30000 |

## FROG CROSSING (metas del motor 1000 / 4000 / 9000)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 73 | CLASICO | 3678 | 1.00 | 73 s | 98 % | 0 % | ×1 | ×1: 1000 / 4000 / 9000 |
| 74 | RAPIDO | 3173 | 0.86 | 63 s | 100 % | 0 % | ×1 | ×1: 1000 / 4000 / 9000 |
| 75 | HORA PUNTA | 4524 | 1.23 | 84 s | 98 % | 0 % | ×1.25 | ×1.25: 1300 / 5000 / 11000 |
| 76 | CARRETERA | 2838 | 0.77 | 68 s | 100 % | 0 % | ×0.8 | ×0.8: 800 / 3200 / 7200 |
| 77 | RIO | 1927 | 0.52 | 47 s | 100 % | 0 % | ×0.7 | ×0.7: 700 / 2800 / 6300 |
| 78 | CONTRARRELOJ | 2959 | 0.80 | 67 s | 98 % | 0 % | ×0.8 | ×0.8: 800 / 3200 / 7200 |
| 79 | 3 CASAS | 3599 | 0.98 | 68 s | 100 % | 0 % | ×1 | ×1: 1000 / 4000 / 9000 |
| 80 | CORRIENTE | 2937 | 0.80 | 60 s | 100 % | 0 % | ×0.8 | ×0.8: 800 / 3200 / 7200 |
| 81 | UNA VIDA | 2088 | 0.57 | 33 s | 100 % | 0 % | ×0.7 | ×0.7: 700 / 2800 / 6300 |
| 82 | EXTREMO | 2863 | 0.78 | 63 s | 100 % | 0 % | ×0.8 | ×0.8: 800 / 3200 / 7200 |

## FLAPPY PIXEL (metas del motor 10 / 30 / 60)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 83 | CLASICO | 151 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 84 | ESTRECHO | 151 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×0.8 (a mano): 8 / 24 / 48 |
| 85 | RAPIDO | 182 | 1.21 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 86 | LUNAR | 87 | 0.57 | 136 s | 57 % | 0 % | ×0.7 | ×0.7: 7 / 21 / 42 |
| 87 | PLOMO | 151 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 88 | MOVILES | 151 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 89 | CUEVA | 177 | 1.17 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 90 | ROCAS | 169 | 1.12 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 30 / 60 |
| 91 | EXTREMO | 58 | 0.38 | 69 s | 85 % | 0 % | ×0.6 | ×0.6: 6 / 18 / 36 |

## MEMORY MATRIX (metas del motor 10 / 25 / 50)

| Slot | Variante | Puntos | Relación | Aguanta | Pierde | Gana | Propuesta | Metas |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 92 | SIMON | 20 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 25 / 50 |
| 93 | SIMON TURBO | 20 | 1.01 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 25 / 50 |
| 94 | INVERSO | 20 | 1.00 | 180 s | 0 % | 0 % | ×1 | ×0.8 (a mano): 8 / 20 / 40 |
| 95 | REFLEJOS | 253 | 12.67 | 180 s | 0 % | 0 % | ×2 | [25, 60, 120] (a mano): 25 / 60 / 120 |
| 96 | MATRIZ 3X3 | 26 | 1.28 | 180 s | 0 % | 0 % | ×1.25 | ×1.25: 13 / 31 / 63 |
| 97 | MATRIZ 4X4 | 19 | 0.96 | 180 s | 0 % | 0 % | ×1 | ×1: 10 / 25 / 50 |
| 98 | PAREJAS | 131 | 6.55 | 180 s | 0 % | 0 % | ×2 | ×2: 20 / 50 / 100 |
| 99 | MARATON | 52 | 2.62 | 180 s | 0 % | 0 % | ×2 | ×2: 20 / 50 / 100 |

## Ajustes a mano

- **08 BLOCK DROP INVISIBLE** (×0.7): La IA lee el tablero aunque las piezas no se vean; a una persona le cuesta mucho más.
- **09 BLOCK DROP SPRINT 40** ([1000, 4000, 8000]): Acaba al completar 40 líneas, así que los puntos tienen techo: ★★ por terminar, ★★★ por terminar con muchas líneas de golpe.
- **10 BLOCK DROP ESPEJO** (×0.8): La IA no nota los controles invertidos.
- **12 BLOCK DROP CAOS** (×0.7): Sin sombra de caída, que la IA no necesita.
- **19 MAZE MUNCHER APAGON** (×0.7): La IA ve el laberinto a oscuras.
- **37 BRICK BREAKER MINI PALA** (×0.8): La IA no falla con la pala pequeña; una persona sí.
- **48 ROAD RACER NOCHE** (×0.8): La IA ve los coches de noche.
- **65 SPACE SHOOTER SIN ESCUDOS** (×1): La IA no se cubre con los escudos y gana al no tenerlos (no le tapan los disparos); a una persona le quitan la cobertura.
- **84 FLAPPY PIXEL ESTRECHO** (×0.8): La IA pasa los huecos estrechos sin fallar.
- **94 MEMORY MATRIX INVERSO** (×0.8): La IA invierte la secuencia sin esfuerzo.
- **95 MEMORY MATRIX REFLEJOS** ([25, 60, 120]): Cada acierto vale un punto y llegan cada 1-2 s: es otra escala de puntos.

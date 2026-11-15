# Presentación LoRa 915 · Sustentación 3D

Presentación interactiva y cinematográfica del Proyecto Integrador (UCP, 2026-2):
un prototipo de comunicación de emergencia con tecnología **LoRa a 915 MHz**, sin red
celular ni internet. Es un solo archivo HTML, funciona **sin conexión**.

**Ábrela:** doble clic en `dist/sustentacion_lora_3d.html` (Chrome o Edge).

## Contenido (15 escenas)
1. Portada
2. Cinemática del terremoto (por qué importa)
3. El problema: cuando la red cae
4. Objetivo: tres señales y una confirmación
5. Telecomunicaciones · espectro: la banda de 915 MHz
6. Circuitos y Señales II: el circuito por dentro (semiconductores, diodos, transistores, amplificación)
7. Hardware: un nodo pieza por pieza (interactivo)
8. Circuito de avisos: luz y sonido en Morse
9. Telecomunicaciones · señales: qué viaja por el aire
10. Por qué LoRa llega lejos: el barrido
11. Protocolo: paquete, ACK y reintentos (interactivo)
12. Interfaz: la pantalla OLED
13. Alcance: el entorno pesa más que la potencia
14. Resultados: lo que el prototipo ya hace
15. Conclusiones: lo aprendido en clase

## Controles
- Flechas ← → , rueda del ratón o deslizar: cambiar de escena.
- Arrastrar con el ratón: girar la vista · doble clic o tecla **R**: restaurar.
- Escena **Hardware**: toca cada componente para ver su función y pines.
- Escena **Protocolo**: pulsa los botones para simular envíos.
- **F** pantalla completa · **S** sonido del zumbador.

## Tecnología
three.js (3D) y GSAP (animación), empaquetados con esbuild en un único HTML offline.
Las fuentes y las pantallas OLED reales del firmware van embebidas.

## Código fuente
- `src/world.js` — geometría 3D (nodos, ciudad, espectro, circuito, mapa, señales)
- `src/cinematic.js` — aldea, personajes articulados y terremoto
- `src/sim.js` — protocolo LoRa, pantallas OLED, audio
- `src/main.js` — escenas, cámara, navegación, interacción, etiquetas
- `src/style.css` · `src/index.tpl.html` — estilos y plantilla
- `assets/` — hojas de sprites OLED (generadas por el mismo código del firmware)
- `build.mjs` — empaqueta todo en `dist/sustentacion_lora_3d.html`

## Recompilar
Requiere Node.js:
```
npm install
node build.mjs
```

## Autores
John Alejandro Piedrahita · Daniel Felipe Colorado · Sebastián Patiño
Ingeniería de Sistemas y Telecomunicaciones — Universidad Católica de Pereira.

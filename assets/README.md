# Biblioteca de Assets

Estructura canonica actual:

```text
assets/
  personajes/
  entornos/
  props/
  animaciones/
  escenas_threejs/
  por_clasificar/
  documentacion/
  tools/
  registro_motor.json
```

Estado actual de la biblioteca Lexury:

- `43` assets catalogados.
- `21` assets con entrada `runtime_ready`.
- `16` escenas Three.js catalogadas.
- `7` categorias fuente principales ya normalizadas dentro de `assets/`.

Rutas principales:

- `assets/personajes`: personajes y criaturas.
- `assets/entornos`: estructuras y escenas de entorno.
- `assets/props`: armas, vestuario y objetos.
- `assets/animaciones`: paquetes de animacion.
- `assets/escenas_threejs`: escenas y demos de referencia.
- `assets/por_clasificar`: material pendiente de clasificacion.
- `assets/documentacion`: catalogos, inventarios y registro maestro.
- `assets/tools`: utilidades de registro y saneamiento.

Registro maestro:

- `assets/registro_motor.json` es el catalogo canonico que debe usar la app.
- Las rutas del registro son relativas a `assets/`.
- Para servir geometria en el navegador, antepone `/assets/` a `preferred_runtime_entry`.

Comandos utiles:

- `npm run assets:organize`: normaliza una importacion Lexury legacy si vuelve a aparecer.
- `npm run assets:sync`: publica solo los assets `runtime_ready` y `registro_motor.json` en `public/assets/`.

Notas:

- `public/assets/` es el destino web para Next.js.
- `documentacion`, `tools`, `escenas_threejs` y `por_clasificar` se conservan como fuente de trabajo, no como contenido runtime principal.

# Netlify Production Guide

## Estado actual

- Proyecto Netlify creado: `intent-classifier-rey30-3d`
- Site ID: `12ae6f70-08c3-47dd-a27b-7e2ebe07cc6c`
- URL principal reservada: `https://intent-classifier-rey30-3d.netlify.app`
- Deploy manual publicado por subida directa: `69c8c3e98baee72a3bd0d5ca`

Ese deploy manual no es un deploy valido del runtime Next.js. Netlify publico archivos estaticos, pero no desplego funciones ni el runtime SSR, por eso la raiz responde `404`.

## Configuracion del repo

El proyecto ahora incluye `netlify.toml` con configuracion explicita para Next.js:

- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: `22`

Esto alinea el repo con la configuracion tipica de Next.js SSR/hibrido en Netlify.

## Ruta correcta para dejarlo operativo

1. Conectar el repositorio GitHub `Rey30empire/IntentClassifier-Rey30-3D` al proyecto de Netlify.
2. Verificar que Netlify detecte:
   - build command: `next build` o `npm run build`
   - publish directory: `.next`
3. Configurar variables de entorno en Netlify con scope para Functions:
   - `DATABASE_URL`
   - `AI_API_KEY` o `OPENAI_API_KEY`
   - `AI_API_URL` o `OPENAI_API_URL` si aplica
   - `AI_MODEL` u `OPENAI_MODEL` si aplica
4. Ejecutar un deploy desde Git para que Netlify construya y publique funciones, middleware y runtime Next.
5. Revisar logs de Functions y del deploy para validar:
   - `/`
   - `/modular-lab`
   - `/api/health`
   - `/api/assets/registry`

## Bloqueos reales pendientes

### 1. Base de datos

Las rutas de presets, favoritos, escenas y modular lab requieren `DATABASE_URL` real apuntando a Neon/PostgreSQL.

### 2. Almacenamiento persistente del Modular Lab

El laboratorio modular ahora ya tiene una capa de storage compatible con Netlify:

Archivo clave:

- `src/lib/modular-lab/storage.ts`

Comportamiento actual:

- en local usa disco (`storage/modular-characters`)
- en Netlify usa `Netlify Blobs`
- fuera de Netlify puede apuntar a Blobs si defines:
  - `NETLIFY_BLOBS_SITE_ID`
  - `NETLIFY_BLOBS_TOKEN`
  - `MODULAR_LAB_STORAGE_PROVIDER=blobs`

Esto resuelve la persistencia del Modular Lab para personajes, partes y ZIPs dentro del limite actual de uploads del modulo.

### 3. Peso de la biblioteca 3D

La biblioteca publicada en `public/assets` ronda `906 MB`, y la biblioteca fuente completa en `assets/` es de varios GB. El deploy manual por subida directa no escalo con ese volumen.

Recomendacion:

- mantener en el repo solo el catalogo y un subconjunto minimo runtime
- mover la biblioteca completa y los binarios pesados a almacenamiento externo/CDN
- servir los assets desde URLs firmadas o rutas CDN

## Validacion recomendada al cerrar la migracion

1. `npm run lint`
2. `npm run build`
3. Deploy por Git en Netlify
4. Probar carga de catalogo real
5. Probar guardado de preset en Neon
6. Probar subida de personaje modular
7. Probar exportacion ZIP y descarga individual

## Nota operativa

El bloqueo principal que sigue siendo serio para Netlify ya no es el Modular Lab, sino la biblioteca 3D multi-GB que sigue dentro del repo y del paquete publicado. Para produccion final conviene externalizar esa biblioteca a storage/CDN.

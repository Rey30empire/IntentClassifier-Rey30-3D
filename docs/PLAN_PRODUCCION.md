# Plan Detallado para Llevar la App a Produccion

## Objetivo

Convertir `IntentClassifier-Rey30-3D` en una aplicacion lista para usuarios reales, con despliegue reproducible, datos persistentes, assets servidos de forma segura y rendimiento estable.

## Estado actual del repo

### Lo que ya existe

- App Next.js App Router con `output: "standalone"`.
- Build y lint funcionales.
- UI principal del motor y viewport operativo.
- Biblioteca Lexury normalizada en `assets/`.
- Registro canonico de assets en `assets/registro_motor.json`.
- Sincronizacion runtime a `public/assets`.
- Prisma ya configurado.

### Lo que hoy impide salida a produccion

- Persistencia principal en SQLite.
- Sin autenticacion ni permisos.
- Character Builder aun depende de mocks.
- Preview 3D del builder sigue siendo placeholder.
- Chat AI sin rate limiting, auditoria ni capa de seguridad.
- Scripts de build/deploy todavia son muy especificos de entorno.
- El paquete runtime de assets publicados ya ronda `906 MB`, demasiado grande para asumir despliegue estatico inocente.

## Arquitectura recomendada para produccion

### Ruta recomendada

Usar despliegue **self-hosted o containerizado** para la app Next standalone, con:

- Next.js en contenedor Node/Bun.
- Caddy o Nginx como reverse proxy.
- Postgres administrado para datos de aplicacion.
- Object storage + CDN para assets 3D y thumbnails.
- Sentry + logs estructurados para observabilidad.

### Ruta alternativa

Usar Vercel solo si antes se resuelven estas condiciones:

- sacar `public/assets` del artefacto de build;
- mover assets a Blob/R2/S3/CDN;
- migrar SQLite a Postgres;
- endurecer rutas API;
- reducir peso del despliegue.

## Fase 0. Cerrar bloqueantes tecnicos

Objetivo: eliminar riesgos que hoy harian fragil una salida a produccion.

### Tareas

1. Subir dependencias base a versiones de seguridad:
   - `next` a linea parcheada segura de 16.1.x o superior.
   - `react` y `react-dom` a 19.2.4 o superior.
2. Definir plataforma objetivo:
   - `Docker + Caddy` como camino principal.
   - `Vercel` solo como opcion secundaria si los assets van fuera.
3. Estandarizar version de runtime:
   - fijar Node LTS o Bun soportado en CI y produccion.
4. Crear matriz de entornos:
   - local
   - staging
   - production
5. Formalizar variables de entorno:
   - base de datos
   - AI provider
   - storage
   - auth
   - observabilidad

### Criterio de salida

- Existe una decision cerrada de plataforma y runtime.
- Las dependencias base quedan en versiones seguras.
- Existe `.env.example` sin secretos.

## Fase 1. Endurecer build y despliegue

Objetivo: que el artefacto de despliegue sea reproducible y portable.

### Tareas

1. Reemplazar los scripts actuales dependientes de path fijo por pipeline portable:
   - eliminar rutas absolutas tipo `/home/z/my-project`;
   - parametrizar `BUILD_DIR`, `PROJECT_DIR` y `PORT`;
   - soportar entorno Linux limpio.
2. Crear `Dockerfile` de produccion:
   - install
   - build
   - copy standalone
   - non-root user
   - healthcheck
3. Crear `docker-compose` o manifest equivalente para staging.
4. Separar build de runtime:
   - build en CI
   - runtime minimal en contenedor final
5. Agregar pipeline CI:
   - install
   - lint
   - build
   - smoke test
6. Definir estrategia de arranque:
   - `NODE_ENV=production`
   - `HOSTNAME=0.0.0.0`
   - proxy HTTP/HTTPS

### Criterio de salida

- Un tercero puede levantar staging con una sola receta reproducible.
- No hay rutas duras a maquinas locales.

## Fase 2. Produccion de datos y persistencia

Objetivo: mover el proyecto de demo local a sistema persistente real.

### Tareas

1. Migrar `SQLite` a `Postgres`.
2. Rediseñar schema Prisma para dominio real:
   - `User`
   - `Session`
   - `AssetFavorite`
   - `CharacterPreset`
   - `SceneProject`
   - `AssetImportJob`
   - `AuditLog`
3. Crear migraciones formales.
4. Desactivar `query logs` en produccion.
5. Agregar backups y politica de restauracion.
6. Preparar seed de staging.

### Criterio de salida

- La app no depende de archivos locales para persistencia principal.
- Los presets y proyectos sobreviven reinicios y despliegues.

## Fase 3. Gestion de assets para produccion

Objetivo: que la biblioteca 3D sea servible, escalable y mantenible.

### Tareas

1. Tratar `assets/registro_motor.json` como unica fuente de verdad.
2. Crear un `AssetRegistryLoader` en la app:
   - lectura del registro;
   - filtros por categoria y subcategoria;
   - resolucion de `preferred_runtime_entry` a URL publica.
3. Mover assets runtime-ready a storage externo:
   - S3/R2/Blob;
   - URLs firmadas o public CDN;
   - cache-control agresivo para GLB.
4. Mantener `assets/` del repo como fuente de trabajo, no como payload final de despliegue.
5. Generar manifiesto runtime separado:
   - solo assets publicables;
   - tamaño;
   - hash;
   - fecha;
   - version.
6. Crear pipeline de conversion para no-runtime-ready:
   - ZIP/TAR -> extraccion;
   - STL/FBX -> GLB;
   - thumbnail generation;
   - validacion de escala y orientacion.
7. Resolver `por_clasificar`:
   - reclasificar lo identificable;
   - marcar el resto como bloqueado.

### Criterio de salida

- Produccion no empaqueta los 900+ MB dentro del artefacto de Next.
- Los assets runtime se sirven por CDN/storage.
- La app puede listar y cargar assets reales desde el registro.

## Fase 4. Funcionalidad real del producto

Objetivo: quitar modo demo y cerrar flujo de usuario principal.

### Tareas

1. Reemplazar `MOCK_ASSETS` y `DemoAssets` por el registro real.
2. Implementar preview 3D real en el Character Builder:
   - GLB loader;
   - loading/error state;
   - orbit camera;
   - fallback visual.
3. Persistir presets reales:
   - guardar;
   - editar;
   - duplicar;
   - borrar;
   - exportar/importar.
4. Crear browser de escenas Three.js:
   - categoria;
   - titulo;
   - runtime;
   - launch hints.
5. Conectar props, entornos y animaciones al motor.
6. Reemplazar metricas hardcodeadas de UI por datos reales o esconderlas hasta tener backend real.

### Criterio de salida

- Un usuario puede abrir la app, ver assets reales, previsualizarlos y guardar configuraciones.

## Fase 5. Seguridad de aplicacion

Objetivo: que las superficies publicas no queden expuestas.

### Tareas

1. Agregar autenticacion:
   - email magic link o provider externo;
   - roles basicos: admin, editor, viewer.
2. Proteger todas las operaciones de escritura.
3. Rate limit para `/api/chat`.
4. Validar payloads con `zod` en todas las rutas.
5. Mover chat a cliente/SDK mas robusto:
   - timeouts;
   - retries controlados;
   - errores normalizados.
6. Sanitizar logs para no filtrar prompts, tokens o rutas sensibles.
7. Revisar headers de seguridad:
   - CSP
   - HSTS
   - frame-ancestors
   - referrer-policy
8. Configurar secreto y rotacion:
   - API keys
   - session secret
   - database credentials

### Criterio de salida

- No hay endpoints publicos criticos sin autenticacion o rate limiting.
- No se exponen secretos en cliente ni logs.

## Fase 6. Observabilidad y operacion

Objetivo: poder detectar y resolver fallos reales.

### Tareas

1. Integrar Sentry o equivalente:
   - frontend
   - route handlers
   - build metadata
2. Estandarizar logs JSON:
   - request id
   - user id
   - route
   - duration
   - status
3. Crear health endpoints:
   - liveness
   - readiness
   - storage connectivity
   - db connectivity
4. Monitorear:
   - errores 5xx
   - latencia p95
   - tiempo de carga de GLB
   - peso de escenas
   - fallos de importacion
5. Dashboard operativo:
   - despliegue actual
   - error rate
   - assets mas cargados

### Criterio de salida

- Existe trazabilidad suficiente para investigar incidentes sin acceder manualmente al servidor.

## Fase 7. Rendimiento y costo

Objetivo: que la app escale con UX razonable.

### Tareas

1. Medir bundle y aislar componentes cliente pesados.
2. Lazy-load de paneles 3D y modulos no criticos.
3. Streaming o skeletons donde haga falta.
4. Cachear catalogo de assets y escenas.
5. Separar metadata de geometria:
   - cargar catalogo ligero primero;
   - descargar GLB solo al abrir preview.
6. Comprimir y versionar assets grandes.
7. Definir limites:
   - peso maximo por asset;
   - peso maximo por escena;
   - tiempo maximo de preview inicial.

### Criterio de salida

- La home y UI principal cargan rapido sin descargar todo el catalogo 3D por adelantado.

## Fase 8. QA, staging y release

Objetivo: que produccion tenga gates reales antes de abrirse.

### Tareas

1. Agregar pruebas automaticas:
   - parser del registro;
   - resolucion de URLs;
   - route handlers;
   - smoke del builder.
2. Crear staging con datos representativos.
3. Ejecutar checklist manual:
   - login
   - browse assets
   - preview GLB
   - guardar preset
   - cargar preset
   - chat
   - escenas
4. Pruebas de regresion sobre build standalone.
5. Pruebas de caida controlada:
   - DB fuera
   - AI provider fuera
   - asset faltante

### Criterio de salida

- Existe staging estable y un checklist de release repetible.

## Orden recomendado de ejecucion

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8

## Primer backlog ejecutable

### Sprint 1

- Definir plataforma de despliegue.
- Crear `.env.example`.
- Actualizar `next` y `react`.
- Crear `Dockerfile`.
- Limpiar scripts hardcodeados.

### Sprint 2

- Migrar Prisma a Postgres.
- Crear modelos reales de negocio.
- Implementar `AssetRegistryLoader`.
- Exponer catalogo real por UI.

### Sprint 3

- Integrar Character Builder con assets reales.
- Implementar preview GLB real.
- Persistir presets.

### Sprint 4

- Auth, rate limiting y observabilidad.
- Staging, smoke tests y checklist de release.

## Definicion de “listo para produccion”

La app se considera lista para produccion cuando:

- despliega de forma reproducible;
- usa base de datos de produccion;
- sirve assets desde storage/CDN;
- no depende de mocks;
- tiene auth y protecciones minimas;
- cuenta con observabilidad;
- pasa build, lint, smoke tests y checklist de release.

# Modular Character Lab

## Objetivo

`Modular Character Lab` agrega al producto una ruta nueva en `src/app/modular-lab/page.tsx` para gestionar personajes 3D modulares sin tocar el flujo principal de `Nexus`. El modulo cubre el MVP real:

1. subir modelos `.fbx`, `.obj`, `.glb`, `.gltf`
2. visualizarlos en un visor 3D interactivo
3. analizar meshes, materiales, rig y animaciones
4. asignar meshes a partes modulares en modo manual o automatico
5. exportar partes individuales como `.glb`
6. guardar personaje, partes, uploads y exports en PostgreSQL
7. descargar original, parte individual, paquete parcial o ZIP completo Unity Ready

## Arquitectura

### Frontend

- `src/app/modular-lab/page.tsx`
  Entrada del App Router con carga dinamica para evitar problemas SSR con Three.js.
- `src/components/modular-lab/ModularCharacterStudio.tsx`
  Shell principal del modulo. Orquesta subida, biblioteca, fragmentacion, exportacion y metadata.
- `src/components/modular-lab/ModularModelViewer.tsx`
  Visor 3D con `@react-three/fiber`, `@react-three/drei`, `GLTFLoader`, `FBXLoader` y `OBJLoader`.

### Dominio y servicios

- `src/lib/modular-lab/constants.ts`
  Taxonomia de partes estandar, extensiones soportadas y reglas base.
- `src/lib/modular-lab/contracts.ts`
  Contratos Zod para analisis, fragmentacion y batch upload de partes.
- `src/lib/modular-lab/client.ts`
  Cliente HTTP para consumir el backend del modulo.
- `src/lib/modular-lab/export-client.ts`
  Exporta fragmentos a `.glb` en cliente con `GLTFExporter`.
- `src/lib/modular-lab/storage.ts`
  Persistencia de archivos, snapshots de metadata y ZIPs.
- `src/lib/modular-lab/server.ts`
  Mapping server-side entre Prisma y respuestas del frontend.
- `src/lib/modular-lab/ui.ts`
  Helpers de UI, cobertura y validaciones base de compatibilidad.

### Backend

Rutas nuevas:

- `GET /api/modular-characters`
- `POST /api/modular-characters`
- `GET /api/modular-characters/[characterId]`
- `PUT /api/modular-characters/[characterId]/fragmentation`
- `POST /api/modular-characters/[characterId]/parts/batch`
- `GET /api/modular-characters/[characterId]/download/original`
- `GET /api/modular-characters/[characterId]/download/zip`
- `GET /api/modular-characters/[characterId]/parts/[partId]/download`

### Base de datos

Modelos Prisma involucrados:

- `Character`
- `CharacterPart`
- `Upload`
- `CharacterExport`
- `User`
- `AuditLog`

## Estructura fisica

Los archivos del modulo quedan en:

```text
storage/modular-characters/
  character-slug-characterId/
    metadata.json
    full_model/
      character.glb
    parts/
      head/
        head.glb
      torso/
        torso.glb
    exports/
      character-slug-unity_static.zip
```

## Flujo de subida

1. El usuario selecciona un archivo soportado.
2. El visor carga localmente el modelo.
3. `ModularModelViewer` construye `ModelAnalysis`.
4. `POST /api/modular-characters` guarda:
   - archivo original
   - metadata del upload
   - resumen del analisis
   - fila `Character`
   - fila `Upload`

## Flujo de fragmentacion

1. El usuario activa una parte estandar.
2. Selecciona meshes desde el visor o la lista.
3. Puede ejecutar fragmentacion automatica por heuristicas de nombre.
4. `PUT /api/modular-characters/[characterId]/fragmentation` guarda el esquema.
5. `exportFragmentAssignmentsToGlb()` genera partes `.glb`.
6. `POST /api/modular-characters/[characterId]/parts/batch` persiste archivos y metadata.

## Flujo de descarga

1. Descarga individual:
   `GET /api/modular-characters/[characterId]/parts/[partId]/download`
2. Descarga original:
   `GET /api/modular-characters/[characterId]/download/original`
3. ZIP completo:
   `GET /api/modular-characters/[characterId]/download/zip?mode=unity_static`
4. ZIP parcial:
   `GET /api/modular-characters/[characterId]/download/zip?mode=unity_rigged&parts=head,torso,left_arm`

## Preparacion para Unity

El modulo ya deja:

- `partKey` normalizado
- `connectionPoint`
- `connectionTarget`
- `exportMode`
- `usedBones`
- `pivot`
- `scale`
- `boundingBox`
- `unityMetadata` a nivel `Character`

Esto deja la base lista para un plugin Unity que:

1. lea `metadata.json`
2. detecte `partKey`
3. monte snap points
4. valide `rigged_modular` vs `static_modular`
5. habilite drag & drop de piezas sobre un personaje base

## Extension points honestos

Las partes mas especializadas quedaron preparadas pero no cerradas al 100:

- conversion nativa avanzada a FBX de salida
- soporte completo para `.gltf` y `.obj` con assets externos empacados
- preservacion avanzada de weights complejos en pipelines no GLB
- auto-fragmentacion semantica por huesos con reglas por esqueleto
- miniaturas automáticas por parte
- versionado historico de personaje y parte
- marketplace de piezas

La base actual deja esos puntos claramente encapsulados para evolucion futura.

## Ejemplo de metadata de personaje

```json
{
  "id": "char_01",
  "name": "SciFi_Soldier_A",
  "sourceFormat": "fbx",
  "meshCount": 28,
  "materialCount": 7,
  "hasRig": true,
  "hasAnimations": false,
  "workflowStatus": "READY",
  "unityMetadata": {
    "exportTarget": "unity",
    "exportMode": "rigged_modular",
    "orientation": "Y_UP",
    "scale": 1
  }
}
```

## Ejemplo de metadata de parte

```json
{
  "id": "part_head_01",
  "partKey": "head",
  "name": "Cabeza base",
  "category": "core",
  "fileFormat": "glb",
  "hasRig": true,
  "usedBones": ["Head", "Neck"],
  "connectionPoints": {
    "source": "head",
    "target": "neck"
  },
  "pivot": [0, 1.62, 0],
  "scale": [1, 1, 1]
}
```

## Ejemplo de endpoint para descargar parte individual

```ts
GET /api/modular-characters/:characterId/parts/:partId/download
```

Respuesta:

- `Content-Type: model/gltf-binary`
- `Content-Disposition: attachment`

## Ejemplo de endpoint para descargar ZIP fragmentado

```ts
GET /api/modular-characters/:characterId/download/zip?mode=unity_rigged&parts=head,torso,left_arm
```

Respuesta:

- `Content-Type: application/zip`
- `Content-Disposition: attachment`

## Ejecucion local

```bash
npm install
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

Variables necesarias:

- `DATABASE_URL`

## Ruta funcional

- Home actual: `/`
- Nuevo modulo: `/modular-lab`

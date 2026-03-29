# Plan de Construccion

## Fase 1. Base productiva

- Crear el modulo como ruta aislada para no romper `Nexus`.
- Extender Prisma con `Character`, `CharacterPart`, `Upload`, `CharacterExport`.
- Persistir archivos en `storage/modular-characters`.
- Validar formatos, tamano y session scope.

## Fase 2. Ingestion y analisis

- Subida local multiple.
- Analisis de meshes, materiales, bones y animaciones en cliente.
- Registro del personaje en PostgreSQL con snapshot JSON.
- Mensajeria clara de estados: `review`, `uploading`, `saving`, `fragmenting`, `ready`.

## Fase 3. Visor profesional

- Carga de `GLB`, `GLTF`, `FBX`, `OBJ`.
- Orbit, zoom, pan.
- Fondo configurable.
- Wireframe.
- Skeleton helpers.
- Pivot helpers.
- Seleccion de meshes desde viewport o lista.

## Fase 4. Fragmentacion

- Taxonomia core y extra.
- Modo automatico por heuristicas.
- Modo manual por seleccion de meshes.
- Guardado del esquema en backend.
- Validaciones base de compatibilidad.

## Fase 5. Exportacion modular

- Exportar partes `.glb` con `GLTFExporter`.
- Persistir batch de partes con metadata.
- Descargar parte individual.
- Descargar ZIP completo.
- Descargar ZIP parcial por seleccion.
- Marcar export como `static_modular` o `rigged_modular`.

## Fase 6. Unity Ready

- Guardar `unityMetadata`.
- Guardar `connectionSchema`.
- Mantener `partKey`, `connectionPoint`, `connectionTarget`, `usedBones`, `pivot`, `scale`.
- Dejar lista la lectura por un futuro plugin Unity.

## Fase 7. Endurecimiento siguiente

- thumbnails automaticas por parte
- importacion de paquetes multi-archivo `.gltf` con buffers/texturas
- exportador FBX server-side
- versionado de partes
- colecciones y marketplace
- auth real por usuario en lugar de `sessionKey` anonima

## Criterios de salida

El modulo se considera listo para pasar a uso productivo interno cuando:

1. `npm run db:generate` pasa
2. `npm run lint` pasa
3. `npm run build` pasa
4. la ruta `/modular-lab` abre sin romper `/`
5. un personaje puede:
   - subirse
   - visualizarse
   - fragmentarse
   - guardar partes
   - descargar ZIP

## Riesgos conocidos

- `.obj` y `.gltf` con recursos externos necesitan una capa de empaquetado mas avanzada.
- la preservacion perfecta de rigs complejos depende del formato fuente y de una etapa especializada adicional.
- hoy el MVP exporta partes en `.glb`; la salida `.fbx` queda como siguiente capa de procesamiento.

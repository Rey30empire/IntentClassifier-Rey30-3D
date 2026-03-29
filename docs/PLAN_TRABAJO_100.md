# Plan de Trabajo para Llevar la App al 100

## Base actual

- La app compila y pasa `lint`.
- La biblioteca Lexury ya esta normalizada en `assets/`.
- Existe un registro maestro real en `assets/registro_motor.json`.
- Inventario actual:
  - `43` assets catalogados.
  - `21` assets runtime-ready.
  - `16` escenas Three.js de referencia.

## Diagnostico resumido

### Lo que ya esta bien

- Base de Next.js estable.
- UI principal del motor funcional.
- Estructura de biblioteca ya separada por dominio.
- Registro de assets ya disponible para dejar de depender de mocks.

### Lo que hoy impide que este al 100

- El Character Builder sigue usando `MOCK_ASSETS`.
- No hay cargador real desde `assets/registro_motor.json`.
- El preview del Character Builder sigue siendo placeholder.
- Los presets aun no persisten en disco o base de datos.
- El viewport general no consume assets reales del catalogo.
- No hay pruebas automatizadas para el flujo de assets.
- `22` assets siguen sin entrada runtime lista o requieren conversion/clasificacion.

## Prioridades reales

### Fase 1. Integracion real de biblioteca

Objetivo: reemplazar mocks por catalogo real.

Entregables:

- Crear un `AssetRegistryLoader` para leer `assets/registro_motor.json`.
- Exponer un modelo tipado para assets runtime-ready y no runtime-ready.
- Construir helpers para resolver URLs publicas desde `/assets/...`.
- Agregar filtros por categoria, subcategoria y estado runtime.

Criterio de salida:

- El front puede listar personajes, entornos, props y animaciones desde el registro real.

### Fase 2. Character Builder conectado a datos reales

Objetivo: que el builder deje de ser demo.

Entregables:

- Reemplazar `MOCK_ASSETS` por datos del registro.
- Mapear `personajes`, `props/Vestuario` y `animaciones/Biped` al builder.
- Mostrar disponibilidad real:
  - runtime-ready
  - requiere conversion
  - sin preview
- Resolver thumbnails o fallback visual por asset.

Criterio de salida:

- El Character Builder muestra assets reales y distingue los que ya pueden cargarse.

### Fase 3. Preview 3D real

Objetivo: visualizar geometria real.

Entregables:

- Cargar GLB desde `preferred_runtime_entry`.
- Renderizar preview 3D dentro del Character Builder.
- Mostrar estados de carga, error y fallback.
- Agregar preview para entornos y props.

Criterio de salida:

- Cualquier asset runtime-ready abre preview 3D dentro de la app.

### Fase 4. Persistencia y escenas

Objetivo: guardar trabajo real del usuario.

Entregables:

- Persistir presets en `db/custom.db` o Prisma.
- Guardar referencias a `asset_id`, colores y combinaciones.
- Crear browser de `escenas_threejs` para abrir demos catalogadas.
- Registrar assets favoritos y recientes.

Criterio de salida:

- El usuario puede guardar, recargar y reutilizar presets y escenas.

### Fase 5. Pipeline de conversion y limpieza

Objetivo: subir la cobertura runtime-ready.

Pendientes principales detectados:

- Personajes no runtime-ready: `14`.
- Entornos no runtime-ready: `3`.
- Props no runtime-ready: `3`.
- Animaciones no runtime-ready: `1`.
- Pendientes por clasificar: `2`, de los cuales `1` ya trae GLB.

Entregables:

- Script para detectar assets sin GLB final.
- Cola de conversion para STL/FBX/source archives a GLB.
- Reclasificacion de `por_clasificar`.
- Generacion de thumbnails.
- Validacion de consistencia del registro.

Criterio de salida:

- La mayoria de assets del catalogo queda en estado runtime-ready o claramente marcada con motivo de bloqueo.

### Fase 6. Calidad y pruebas

Objetivo: dejar confianza operativa.

Entregables:

- Tests de parser del registro.
- Tests de resolucion de URLs y filtrado.
- Smoke test de carga de GLB runtime-ready.
- Validacion de rutas rotas en `public/assets`.
- Checklist de regresion para builder, viewport y escenas.

Criterio de salida:

- El flujo principal de assets queda cubierto por pruebas automatizadas y una verificacion manual corta.

## Orden recomendado de ejecucion

1. Cargador del registro y tipos compartidos.
2. Integracion del Character Builder sin mocks.
3. Preview 3D real de GLB.
4. Persistencia de presets.
5. Browser de escenas Three.js.
6. Pipeline de conversion y clasificacion pendiente.
7. Tests y endurecimiento final.

## Meta de “100”

Considero la app “al 100” cuando cumpla estas condiciones:

- Usa `assets/registro_motor.json` como fuente unica de verdad.
- No depende de mocks para assets.
- Puede previsualizar assets runtime-ready.
- Puede guardar y reabrir presets.
- Puede navegar escenas de referencia.
- Tiene un pipeline claro para assets incompletos.
- Tiene pruebas minimas del flujo de assets y build estable.

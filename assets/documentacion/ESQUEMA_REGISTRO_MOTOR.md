# Esquema del registro del motor

- `tools/generate_runtime_registry.js`: regenera catalogos y manifiestos.
- `tools/engine_registry_loader.js`: loader neutral en Node/JS para leer el registro.
- `REGISTRO_MOTOR.json`: une assets y escenas en un solo indice.

## Assets

- Fuente: `meta/asset_manifest.json` dentro de cada asset.
- Campo principal para runtime: `preferred_runtime_entry`.
- Los conteos indican formatos disponibles y material auxiliar.

## Escenas

- Fuente: carpetas dentro de `escenas_threejs`.
- Cada escena genera `meta/scene_manifest.json`.
- `source_type=procedural_code` indica que no se detectaron binarios embebidos.
- `launch.recommended_command` te dice la forma mas directa de abrir o probar la escena.

## Regeneracion

```bash
node tools/generate_runtime_registry.js
```

Si agregas assets o escenas nuevas, vuelve a ejecutar ese comando para refrescar el indice global.

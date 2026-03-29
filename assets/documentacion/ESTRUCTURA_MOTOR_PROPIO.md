# Estructura para motor propio

- `source_archives`: paquetes originales `.zip` y `.tar`.
- `geometry/glb`: mallas GLB listas para una ruta de importacion moderna.
- `geometry/fbx`: FBX sueltos o carpetas extraidas con `.fbx` y `.fbm`.
- `geometry/stl`: geometria STL preservada como fuente secundaria.
- `textures`: texturas sueltas cuando no forman parte de un paquete FBX.
- `imports`: material no clasificado automaticamente o carpetas auxiliares.
- `meta/asset_manifest.json`: manifiesto del asset con rutas relativas y formato preferido.

El catalogo global esta en `CATALOGO_ASSETS.json` y `CATALOGO_ASSETS.csv`.

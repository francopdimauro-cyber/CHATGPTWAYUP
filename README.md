# WayUp WebCreator

Constructor de páginas web impulsado por NVIDIA Nemotron 3 Ultra y desplegable en Cloudflare Workers.

## Alcance del proyecto
Este repositorio es independiente de WAYUP, WAY.APP y de otros Workers y repositorios. No se modifica ningún otro proyecto.

## Versión preparada
V3: formulario de seis pasos y briefing estructurado; motor de generación y refinamiento de HTML; vista previa aislada y descarga de la web.

La implementación completa se ha empaquetado en un ZIP de desarrollo. Pendiente incorporar el contenido de `public/index.html`, `src/worker.js` y `package.json` a este repositorio y desplegar el nuevo Worker.

## Configuración requerida
- `NVIDIA_API_KEY`: secreto privado de la API NVIDIA.
- `WEBCREATOR_ACCESS_TOKEN`: secreto privado para limitar acceso al prototipo.
- Worker nuevo: `wayup-webcreator`.

No incluir claves en el código ni en GitHub. No activar generación pública sin controles de acceso y cuotas.

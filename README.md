# WAYUP WebCreator · Studio + Multi-IA

Constructor privado de webs para clientes. **Rama de desarrollo:** `feature/studio-reliability-hardening`. La versión desplegada de `wayup-webcreator` no se actualiza automáticamente con esta rama.

## Qué incluye

- Constructor guiado de seis pasos y generación de HTML completo mediante streaming de **OpenRouter**.
- Tres modelos configurados: `nvidia/nemotron-3-ultra-550b-a55b:free` (constructor), `nvidia/nemotron-3.5-super-vl:free` (referencias visuales) y `cohere/north-mini-code:free` (revisión/refinamiento). Disponibilidad dependiente de OpenRouter.
- Guía de dirección artística original integrada en el prompt del constructor. Preserva marca, jerarquía, responsive y editabilidad; ver `docs/DESIGN_DIRECTOR.md`.
- WebCreator Studio: biblioteca privada, Canvas visual con modos editar/previsualizar/código, cambio de textos, estilos, imágenes por URL y enlaces, historial de versiones y recuperación.
- Auditoría HTML estática sin consumo de IA desde Studio: estructura, metadatos, enlaces, IDs, imágenes y recursos inseguros básicos. **No sustituye las pruebas de navegador, accesibilidad y seguridad.**
- Descarga de HTML y ZIP; recuperación de borradores y copias de generación en D1.
- Nuevo diseño de interfaz en `public/studio-theme.css`, cargado después de las hojas existentes sin cambiar los IDs funcionales.

## Arquitectura y permisos

- Worker privado: `wayup-webcreator`; autenticación obligatoria mediante Cloudflare Zero Trust Access.
- Secreto en Cloudflare: `OPENROUTER_API_KEY`. Binding D1: `USAGE_DB`.
- Las claves API nunca se envían al navegador ni se almacenan en GitHub.
- Contadores internos: **50 llamadas/día UTC** y **10 llamadas por briefing/proyecto**; se aplican además los límites y restricciones de OpenRouter.
- Tablas `generation_cache`, `generation_drafts`, `multi_ai_usage_events`, `webcreator_projects`, `webcreator_project_versions`.
- Migración Studio: `migrations/0002_studio.sql`. Solo ejecutar al preparar un entorno, no repetir a ciegas en producción.
- Endpoints Studio: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `GET /api/projects/:id/versions`, `GET /api/projects/:id/versions/:n`, `GET /api/projects/:id/quality`.

## Construcción y pruebas

Requiere Node.js 20 o superior:

```bash
npm run check
```

Ejecuta `scripts/build.mjs`, genera `dist/worker.js`, comprueba sintaxis y pasa la suite de pruebas de regresión. `.github/workflows/webcreator-ci.yml` lo ejecuta en GitHub Actions para la rama de endurecimiento.

**Este comando no despliega nada.** Para desplegar hay que comprobar primero migraciones y bindings, proteger los secretos y planear recuperación. La edición en el Canvas no usa llamadas de IA.

## Limitaciones actuales que siguen pendientes

- La generación sigue ligada al streaming de la pestaña; cerrar la sesión o perder conexión puede interrumpir el proceso. Cloudflare Workflows/Queues duraderos aún no están implementados.
- El editor todavía no permite arrastrar libremente secciones ni tiene almacenamiento de imágenes en R2.
- Los formularios, pagos y reservas requieren backend real.
- No hay pipeline de publicación en dominios de clientes con pruebas visuales automáticas, backups externos y rollback.
- Las pruebas actuales validan sintaxis y contratos de integración; **no equivalen a ejecutar todas las webs generadas en Firefox/Chromium ni a una auditoría de seguridad completa**.
- Antes de publicar webs generadas por IA deben revisarse enlaces, datos comerciales, licencias de imágenes, accesibilidad, protección de datos, funcionamiento y rendimiento.

## Aislamiento del proyecto

No modificar WAYUP, WAY.APP, recursos de `futuregipsy` ni la rama `main` al trabajar en WebCreator. Mantener los cambios en ramas y exigir pruebas antes del despliegue.

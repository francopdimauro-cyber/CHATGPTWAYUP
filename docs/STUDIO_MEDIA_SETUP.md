# Activación de imágenes · WebCreator Studio

## Estado del desarrollo
- Implementado en la rama `feature/studio-pro-fonts`. NO publicado en el Worker de producción.
- Galería privada: imágenes JPEG, PNG y WebP hasta 5 MB por archivo; eliminación y reutilización entre webs.
- Editor Canvas: elegir imágenes, sustituir o añadir al elemento/sección seleccionada, ajustar `object-fit`, `object-position`, ancho máximo y `alt`.
- Exportación HTML/ZIP: los recursos privados de R2 referenciados se incrustan como data URI en el documento exportado, hasta 25 archivos y 28 MB de datos base64.
- Generación de imágenes bajo demanda con `@cf/black-forest-labs/flux-1-schnell`, máximo **10 imágenes al día UTC**. Cada clic crea una imagen; no se generan automáticamente al abrir Studio.
- Las cuotas de Workers AI son independientes de este límite y pueden aplicar restricciones o cargos.

## Bloqueo actual
La API de Cloudflare respondió: `403 / 10042 — Please enable R2 through the Cloudflare Dashboard`.

El Worker desplegado actualmente tiene:
- `OPENROUTER_API_KEY` (secret)
- `USAGE_DB` (D1)

Todavía **NO** tiene `STUDIO_ASSETS` (R2) ni `AI` (Workers AI).

## Para activar el módulo en Cloudflare (sin tocar WAYUP ni WAY.APP)
1. Entrar a Cloudflare Dashboard con la cuenta asociada a `wayup-webcreator`.
2. Abrir **R2 Object Storage** y activar R2 para esa cuenta. La activación puede requerir aceptar condiciones o configurar facturación; verificar costes antes de continuar.
3. Crear un bucket privado llamado `wayup-webcreator-assets`. No habilitar un dominio público ni `r2.dev`.
4. Abrir **Workers & Pages → wayup-webcreator → Settings → Bindings**. Añadir R2 bucket binding con variable **`STUDIO_ASSETS`** apuntando al bucket creado.
5. Añadir un binding de **Workers AI** llamado **`AI`**, si la cuenta y su plan lo permiten.
6. Aplicar la migración SQL `migrations/0003_studio_media.sql` a la misma base D1 ya vinculada como `USAGE_DB`. Es una tabla nueva y no altera las tablas de generación.
7. Desplegar la compilación de la rama `feature/studio-pro-fonts` manteniendo estrictamente los bindings de secretos, D1, R2 y Workers AI. Confirmar que se conserva `ctx.access.getIdentity()` y la protección Zero Trust.
8. Verificar `GET /api/media/status` desde la sesión privada: `storage:true` y `generator:true`.
9. Probar subida PNG/JPEG/WebP, visualización desde Canvas, guardado, reapertura, generación de prueba, exportación ZIP y límites de cuota antes de darlo por terminado.

## Seguridad
- Todas las rutas `/api/media` se ejecutan tras validar identidad en Cloudflare Access.
- Las escrituras requieren `Origin` igual al origen del Worker.
- Los binarios se verifican por firma (no solo por cabecera). SVG, GIF y archivos ejecutables están bloqueados.
- La API comprueba tamaño, tipo, IDs y límites; nunca expone credenciales al navegador.
- Los archivos no son públicos. La exportación convierte las imágenes privadas usadas a `data:` para que sigan funcionando fuera de la sesión privada.
- No borrar recursos en uso por webs exportadas antes de comprobar su funcionamiento.
- La generación de imágenes debe utilizarse con prompts y fotografías de las que se tenga derecho de uso.

## Límites conocidos
- R2 no está activado: no afirmar que guardar o generar imágenes funcione en producción.
- El módulo de imágenes no modifica la IA principal de creación de webs ni añade fotografías automáticamente a cada generación.
- La exportación incrusta imágenes por simplicidad; más adelante se puede producir un ZIP de archivos binarios con referencias relativas para sitios de gran tamaño.
- Las peticiones de generación tienen cuota interna de 10 al día, pero no se ha configurado todavía un presupuesto de uso real de Workers AI en Cloudflare.

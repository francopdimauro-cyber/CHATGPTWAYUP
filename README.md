# WayUp WebCreator V4

Constructor web de seis pasos con generación mediante Nemotron 3 Ultra (NVIDIA), vista previa aislada, iteraciones mediante IA y descarga de proyectos ZIP editables.

## Despliegue independiente

- Cloudflare Worker: `wayup-webcreator`
- Dirección esperada: https://wayup-webcreator.francopdimauro.workers.dev/
- Código: `public/index.html` (interfaz), `src/worker.js` (API), `scripts/build.mjs` (compilación)
- WAYUP, WAY.APP y demás recursos NO se modifican.

## Compilar

```sh
npm run check
```

Esto genera `dist/worker.js`, que contiene la interfaz HTML incorporada al Worker y el backend. Publicar como Worker ES module con el archivo `dist/worker.js` como módulo principal.

## Acceso privado y configuración

- La aplicación está protegida mediante **Cloudflare Zero Trust Access**, asociada exclusivamente al Worker `wayup-webcreator` y a la identidad autorizada en su política.
- El Worker verifica obligatoriamente `ctx.access` y el correo autenticado antes de servir la interfaz o ejecutar una API. En ausencia de una identidad validada, deniega la petición.
- **Único secreto necesario para la IA:** `NVIDIA_API_KEY`, configurado como Secret en Cloudflare. Nunca se envía al navegador ni se almacena en GitHub.
- **D1:** binding `USAGE_DB` a la base de datos privada `wayup-webcreator-usage` para contabilizar un máximo global de cinco peticiones por día UTC y cachear HTML terminado.
- La antigua contraseña de 256 bits se ha eliminado tanto del backend y formulario como de los secretos del Worker. No hay que configurar ninguna contraseña adicional.

## API actual

- `GET /api/health`: diagnóstico general tras iniciar sesión con Access.
- `GET /api/quota`: llamadas disponibles sin gastar cuota.
- `GET /api/provider-check`: consulta el catálogo de modelos de NVIDIA; no realiza inferencia.
- `POST /api/generate-stream`: generación en streaming SSE con estados de conexión y recepción.
- `POST /api/refine-stream`: modificación del HTML anterior con streaming SSE.

Las rutas antiguas `/api/generate` y `/api/refine` están desactivadas para evitar peticiones prolongadas sin streaming. Todas las rutas del Worker requieren autenticación de Cloudflare Access.

## Seguridad y limitaciones

Vista previa con `iframe sandbox="allow-scripts"` sin `allow-same-origin`; autenticación en backend, comprobación de origen, límites básicos de tamaño y filtrado de HTML. **Esto es un prototipo privado**: antes de ofrecerlo al público hay que introducir cuotas/rate limiting efectivos por usuario, gestión de usuarios, control de costes, auditoría de código generado y almacenamiento de proyectos.

El ZIP incluye `index.html`, `styles.css`, `script.js` (si procede) y `README.txt`. Las imágenes remotas no se incluyen y requieren conexión o sustitución por archivos propios. Formularios, reservas o pagos necesitan integraciones reales. Las cargas de archivos del formulario no incorporan todavía sus contenidos a la IA.

El enlace público puede tardar en propagarse tras activar el subdominio. El Worker está desplegado, pero la conexión real con NVIDIA no puede verificarse hasta configurar la clave.

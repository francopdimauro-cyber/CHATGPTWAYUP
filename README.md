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

## Configurar antes de generar

En **Cloudflare → Workers & Pages → wayup-webcreator → Settings → Variables and Secrets** añadir **Secret**:

- `NVIDIA_API_KEY`: clave de NVIDIA Build. Solo backend.
- `WEBCREATOR_ACCESS_TOKEN`: contraseña larga, aleatoria e independiente para el acceso de prueba al constructor.

Nunca introducir la API key de NVIDIA en el formulario, en un archivo de GitHub o en el navegador.

El formulario solicita **solo** `WEBCREATOR_ACCESS_TOKEN`. Mientras falte cualquiera de los secretos, `/api/generate` y `/api/refine` responden 503, sin consumir NVIDIA.

## API

- `GET /api/health`: estado, modelo y configuración de secretos (sin revelar sus valores)
- `POST /api/generate`: JSON `{"briefing":"..."}`
- `POST /api/refine`: JSON `{"briefing":"...","html":"...","changes":"..."}`

Ambos endpoints POST exigen `Authorization: Bearer <WEBCREATOR_ACCESS_TOKEN>`.

## Seguridad y limitaciones

Vista previa con `iframe sandbox="allow-scripts"` sin `allow-same-origin`; autenticación en backend, comprobación de origen, límites básicos de tamaño y filtrado de HTML. **Esto es un prototipo privado**: antes de ofrecerlo al público hay que introducir cuotas/rate limiting efectivos por usuario, gestión de usuarios, control de costes, auditoría de código generado y almacenamiento de proyectos.

El ZIP incluye `index.html`, `styles.css`, `script.js` (si procede) y `README.txt`. Las imágenes remotas no se incluyen y requieren conexión o sustitución por archivos propios. Formularios, reservas o pagos necesitan integraciones reales. Las cargas de archivos del formulario no incorporan todavía sus contenidos a la IA.

El enlace público puede tardar en propagarse tras activar el subdominio. El Worker está desplegado, pero la conexión real con NVIDIA no puede verificarse hasta configurar la clave.

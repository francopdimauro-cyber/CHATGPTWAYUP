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
- **D1:** binding `USAGE_DB` a la base de datos privada `wayup-webcreator-usage` para contabilizar un máximo global de diez peticiones por día UTC durante las pruebas y cachear HTML terminado.
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

## Pruebas desde móvil

El navegador móvil puede suspender una pestaña y cortar una respuesta SSE. El aumento de cuota a diez peticiones por día **no evita** que se pierda una generación en curso. La caché actual solo recupera páginas que llegaron a completarse y guardarse. Para reanudar trabajos de 20 minutos sin dejar el navegador abierto es necesario un proceso duradero independiente del navegador (por ejemplo, Cloudflare Workflows + D1), aún no implementado.

## Recuperación de borradores (V4.2)

- Durante el streaming, el Worker guarda en D1 el código parcial aproximadamente cada 4.500 caracteres y registra el estado final del trabajo.
- La interfaz recuerda el ID del trabajo en el almacenamiento local del navegador y ofrece **Recuperar último proyecto**, sin gastar una petición de NVIDIA. Si el HTML terminó, puede abrirse y descargarse; si terminó incompleto, permite descargar únicamente el **borrador HTML incompleto**.
- La barra de porcentaje usa como **referencia de tamaño** los 37.278 caracteres de Aura Estética. Es comparativa, NO una estimación del porcentaje real de generación.
- Nemotron tiene un máximo configurado de 24.000 tokens de salida en streaming. NVIDIA documenta que el modelo admite hasta 32.768; el aumento busca evitar cortes prematuros por longitud.
- **Limitación conocida:** el proceso de generación sigue vinculado a la conexión de streaming. Cambiar de pestaña o cerrar la aplicación puede cancelar la llamada y no garantiza que la IA siga trabajando. La recuperación solo permite leer el HTML que el servidor alcanzó a guardar. La ejecución verdaderamente independiente del navegador requiere migrar el motor a Cloudflare Workflows o una arquitectura durable equivalente.
- Los proyectos generados **antes de habilitar los borradores** no se pueden recuperar si no llegaron a terminar y cachearse.

## Validación HTML y preservación de resultados

El validador ahora admite documentos HTML5 completos aunque carezcan de `<!DOCTYPE html>`, estén rodeados de un bloque Markdown o contengan un `iframe` legítimo (por ejemplo, mapas). Añade cierres triviales faltantes, sin recortar secciones generadas, y comunica advertencias en la interfaz. **No equivale a una auditoría de seguridad del código generado**, que debe revisarse antes de publicar. No se considera web completa un documento con `<script>` o `<style>` sin cerrar, ni una salida cortada por límite de tokens sin cierre HTML.

Si la salida no es válida se guarda como borrador parcial en D1, con motivo de fallo y enlace de recuperación. El cliente intenta recuperar el borrador tras un error y permite descargarlo sin hacer una nueva llamada. El conteo de llamadas sigue siendo de **10 por día UTC durante las pruebas**. No hay garantía de recuperar generaciones antiguas anteriores al sistema de borradores.

## Continuaciones automáticas de Nemotron

En el modo de streaming, WebCreator genera la primera parte del HTML con un máximo de 24.000 tokens de salida. Si el archivo se corta por longitud o termina incompleto, solicita **hasta dos fragmentos adicionales** a NVIDIA (máximo 15.000 tokens cada uno), con el resumen del briefing y la cola del HTML ya generado. Intenta reanudar desde el último elemento terminado, sin regenerar todo desde cero. Cada llamada adicional **se contabiliza en D1** y queda sujeta al límite global de **10 solicitudes diarias** durante las pruebas. La interfaz muestra cuándo comienza cada continuación y la cuota restante. Si persiste el fallo, el borrador queda en D1 y puede descargarse.

No hay garantía de que el modelo continúe de forma perfecta entre fragmentos; hay que revisar los límites de las secciones, los enlaces, el JavaScript y las imágenes antes de entregar una web comercial. En el caso de desconexión del móvil, el trabajo todavía depende de la sesión de streaming: una arquitectura duradera mediante Workflows queda pendiente.

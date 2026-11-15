# WAYUP Studio Next + Agent Builder — Integración de prueba

**Destino exclusivo:** Worker de Cloudflare \`wayup-studio-next-preview\`.

## Qué contiene la primera integración

- Panel «Agentes IA» en la interfaz ya compilada de Studio Next (sin rehacer el diseño React).
- Puente autenticado con **Service Binding** \`AGENT_BUILDER\` -> \`agent-factory-free\`.
- Formulario de acceso mediante cuenta de Agent Builder: la sesión se transmite con cookie \`HttpOnly\`, \`Secure\`, \`SameSite=Lax\` y no se almacena en JavaScript.
- Selección de agentes activos, creación mediante proveedor de IA ya configurado en Agent Builder, activación y publicación de chats con dominio permitido.
- Generación del script público de integración, copia y archivo TXT descargable.
- Fusión **local** de un ZIP sin compresión generado por WebCreator y un chat: añade el widget a \`index.html\`, preserva CSS/JS y deja instrucciones en \`README.txt\`. Sin subir el ZIP al servidor.

## Repositorios y datos que NO se modifican

No altera el código, usuarios, sesiones ni bases de datos de los Workers \`agent-factory-free\` o \`wayup-webcreator\`. Solo se crea un agente/chat nuevo si el usuario inicia sesión y confirma la operación. En el repositorio, el trabajo vive en \`feature/studio-next-agentes-bridge-20261115\`; \`main\` permanece intacta.

## Restricciones actuales

1. El editor Studio Next empaquetado es un prototipo React con persistencia local y proyecto de muestra; **todavía no importa webs reales ni guarda proyectos en D1/R2**.
2. La generación web utiliza el WebCreator existente mediante enlace (otra pestaña), no una interfaz integrada todavía. No simular que la generación dentro de Studio está conectada.
3. El ZIP combinado se produce después de generar una web en WebCreator y crear o seleccionar un chat real en Agent Builder. Solo admite el formato ZIP STORE que utiliza WebCreator; rechaza ZIP dañados, rutas sospechosas y contenido comprimido.
4. Cuando el sitio no está desplegado en el dominio HTTPS autorizado, el widget real puede rechazar mensajes. Abrir \`index.html\` directamente desde el disco no es una prueba del backend.
5. El panel es una primera versión. Las pruebas automáticas no sustituyen la comprobación manual de login, selección y publicación de chat desde la URL de preview.
6. El Worker de preview estático se desplegó mediante Cloudflare API con un parche mínimo de recursos y Service Binding, **no** se modificó el Worker de WebCreator ni las credenciales del agente.

## Archivos de integración

- \`src/studio-next-agents-bridge.js\`: proxy de rutas de Agent Builder permitidas, servicio privado, sesión y protección de origen.
- \`public/studio-next-agents-panel.js\`: controles y unión de proyectos ZIP en el navegador.
- \`public/studio-next-agents-panel.html\` y \`.css\`: interfaz.
- \`scripts/patch-studio-next-agent-preview.mjs\`: parche seguro para la compilación original estática Next.js.
- \`tests/studio-next-agents-bridge.test.mjs\` y \`tests/studio-next-agente-zip.test.mjs\`: pruebas.
- \`.github/workflows/studio-next-agentes-ci.yml\`: verificación automatizada.

## Próximas integraciones para una plataforma unificada

1. Autenticación única que no exija iniciar sesión por separado en cada motor.
2. Backend de proyectos y versiones con D1/R2, no solo localStorage.
3. Generación WebCreator mediante servicio interno autenticado y puente seguro de streaming.
4. Control de agente como un atributo versionado del proyecto, incluyendo vista previa y exportación ZIP sin importar archivos a mano.
5. Despliegue de web y Worker de agente con aislamiento por cliente, sin copiar claves ni mezclar cuotas.

**No activar API keys de terceros ni ejecutar despliegues adicionales sin comprobar límites gratuitos y permisos.**

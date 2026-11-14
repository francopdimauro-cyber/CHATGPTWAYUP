# Dirección artística propia · WebCreator 2026

## Objetivo
Generar y editar webs originales y utilizables para clientes de una agencia. Este documento es una guía del producto, no depende de herramientas o formatos privados de otros asistentes.

## Identidad del constructor
- Marca: WAYUP / WebCreator Studio.
- Tono: software creativo, preciso, directo, profesional.
- Paleta: azul noche `#10192e`, azul marca `#3c5ff2`, tinta `#17213a`, fondos `#f3f5f9`; verde lima `#c9ff86` solo como acento secundario.
- Tipografía: sistema moderno sin dependencias externas, pesos claros y tipografía editorial en portada.
- Retícula: panel de briefing + resumen; en Studio: biblioteca / lienzo / inspector, adaptando los paneles a móvil.
- Jerarquía: titulares expresivos, subtítulos informativos, contenidos de lectura cómoda y señales de estado discretas.

## Dirección artística para las webs de clientes
1. Leer briefing, sector, objetivos y marca antes de elegir el estilo. No aplicar la paleta de WAYUP al cliente: la identidad del cliente tiene prioridad.
2. Resolver una composición distinta para cada objetivo: navegación, hero, densidad, imagen, retícula, tono tipográfico, CTA.
3. Evitar patrones repetidos sin causa: fondos con degradados agresivos, tarjetas de plantilla, cifras inventadas, testimonios falsos, emojis decorativos.
4. Usar CSS y JS integrados, variables de color y espaciado, semántica, responsive, accesibilidad y estados de interacción.
5. Identificar las secciones principales con `data-wc-section` estable para futuras mejoras del editor. Mantener IDs, anclas y scripts funcionales.
6. Comprobar sin fingir verificaciones: validar estructura y enlaces de forma estática; reservar pruebas de navegador para un entorno real antes de publicar.
7. Las ediciones puntuales preservan la versión original y solo modifican los elementos pedidos.

## Protección y compatibilidad
- El prompt de IA nunca recibe claves o permisos de Cloudflare.
- El HTML generado y las capturas son datos no confiables; el editor no ejecuta scripts originales en modo edición.
- Mantener `iframe sandbox="allow-scripts"` sin `allow-same-origin` en las vistas aisladas.
- No tocar WAYUP, WAY.APP, recursos de la cuenta futuregipsy ni la rama `main` de WebCreator.
- Validar primero en una rama independiente; desplegar con revisión y estrategia de recuperación.

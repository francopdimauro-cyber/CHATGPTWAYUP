/*
 * WAY UP Studio Next · puente mínimo con Agent Builder.
 *
 * Seguridad:
 * - Solo rutas explícitamente permitidas (no proxy genérico).
 * - No gestiona contraseñas, no guarda tokens; delega en autenticación del Agent Builder.
 * - Sesiones HttpOnly SameSite=Lax, vinculadas al hostname de Studio (proxy mismo origen).
 * - Exige Origin de Studio en mutaciones para protección CSRF.
 * - Service binding AGENT_BUILDER: llamada privada entre Workers, sin URL abierta.
 * - Todo mensaje es JSON de tamaño limitado; respuestas sin cachear.
 */
const WAYUP_AGENT_SERVICE_ORIGIN = "https://agent-factory-free.francopdimauro.workers.dev";
const WAYUP_AGENT_ROUTES = [
  ["GET", /^\/auth\/me$/],
  ["POST", /^\/auth\/login$/],
  ["POST", /^\/auth\/logout$/],
  ["GET", /^\/agents$/],
  ["GET", /^\/agents\/[0-9a-f-]{36}$/i],
  ["POST", /^\/agents$/],
  ["POST", /^\/agents\/generate$/],
  ["POST", /^\/agents\/[0-9a-f-]{36}\/status$/i],
  ["GET", /^\/public-chats$/],
  ["POST", /^\/public-chats$/],
  ["PUT", /^\/public-chats\/[0-9a-f-]{36}$/i]
];
function wayupStudioAgentJson(body, status) {
  return new Response(JSON.stringify(body), {
    status, headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
async function wayupStudioAgentBridge(request, env) {
  const url = new URL(request.url);
  const prefix = "/studio-api/agents";
  if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return null;
  const suffix = url.pathname.slice(prefix.length);
  if (!WAYUP_AGENT_ROUTES.some(([method, pattern]) => method === request.method && pattern.test(suffix))) {
    return wayupStudioAgentJson({error:"Operación no disponible en Studio."},405);
  }
  if (!env?.AGENT_BUILDER?.fetch) {
    return wayupStudioAgentJson({error:"No está configurada la conexión privada con Agent Builder."},503);
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return wayupStudioAgentJson({error:"Origen no autorizado."},403);
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
      // El cierre de sesión no necesita cuerpo, pero la API existente sí acepta JSON.
      return wayupStudioAgentJson({error:"Envía JSON."},415);
    }
  }
  let body;
  if (request.method !== "GET") {
    const raw = await request.text();
    if (raw.length > 24_000) return wayupStudioAgentJson({error:"Solicitud demasiado grande."},413);
    body = raw;
  }
  const upstream = new URL("/api" + suffix, WAYUP_AGENT_SERVICE_ORIGIN);
  const headers = new Headers();
  headers.set("Accept","application/json");
  // Reescribimos Origin por el del destino tras validar el origen REAL del navegador.
  // Agent Builder también verifica el Origin con la URL del Request.
  if (request.method !== "GET") {
    headers.set("Origin", WAYUP_AGENT_SERVICE_ORIGIN);
    headers.set("Content-Type","application/json");
  }
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const session = cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("af_session="));
    if (session) headers.set("Cookie", session);
  }
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("CF-Connecting-IP", ip);
  try {
    const forwarded = await env.AGENT_BUILDER.fetch(new Request(upstream.toString(),{
      method:request.method,headers, ...(body!==undefined?{body}:{}),redirect:"manual",
    }));
    const responseHeaders = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    });
    const setCookie = forwarded.headers.get("Set-Cookie");
    if (setCookie) {
      // Solo copiamos la cookie de sesión esperada. Nunca se expone en JavaScript.
      if (/^af_session=/.test(setCookie)) responseHeaders.set("Set-Cookie",setCookie);
    }
    const responseBody = await forwarded.text();
    if (responseBody.length > 300_000) return wayupStudioAgentJson({error:"Respuesta demasiado grande."},502);
    return new Response(responseBody,{status:forwarded.status,headers:responseHeaders});
  } catch {
    return wayupStudioAgentJson({error:"No se pudo contactar con el servicio privado de agentes."},502);
  }
}

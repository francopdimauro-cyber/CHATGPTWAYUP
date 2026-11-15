/**
 * Transformación reproducible del Worker Next.js *ya compilado* en preview.
 * No recompila ni modifica la maqueta React: inserta una herramienta aislada.
 * Exige marcadores exactos y falla antes de escribir si la plantilla cambia.
 */
export function patchPreviewWorker(source,bridge,client,css,html,projectsBridge=''){
  const fetchStart="  async fetch(request) {";
  const methodGuard="    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Método no permitido',{status:405,headers:{Allow:'GET, HEAD'}});";
  const dataLine="    const data=request.method==='HEAD'?null:bytesFor(path);";
  const top="export default {\n";
  if(typeof source!=="string"||source.length<1000)throw Error("No es un Worker Next.js compilado válido");
  if(source.includes("WAYUP_STUDIO_AGENT_BRIDGE_V1"))throw Error("El Worker ya contiene esta integración: no sobrescribir.");
  if(projectsBridge && !projectsBridge.includes("export async function wayupStudioProjectsBridge("))throw Error("Puente de proyectos no válido.");
  for(const marker of [fetchStart,methodGuard,dataLine,top,"const FILES = new Map(Object.entries("]){
    if(!source.includes(marker))throw Error("Worker de preview incompatible. Falta marcador: "+marker);
  }
  if(!bridge.includes("async function wayupStudioAgentBridge(")||!client.includes("wayup-agent-open")||
     !css.includes("#wayup-agent-open")||!html.includes('id="wa-manager"')){
    throw Error("Falta un archivo de integración.");
  }
  if(source.indexOf(fetchStart)!==source.lastIndexOf(fetchStart))throw Error("fetch ambiguo");
  let out=source.replace(fetchStart,"  async fetch(request,env) {");
  const projectGate=projectsBridge?"    const projects=await wayupStudioProjectsBridge(request,env);\n    if(projects)return projects;\n":"";
  const prefix=projectGate+"    const bridge=await wayupStudioAgentBridge(request,env);\n"+
    "    if(bridge)return bridge;\n"+
    "    const assetPath=new URL(request.url).pathname;\n"+
    "    const wayupExtra={\n"+
    "      '/studio-next-agents-panel.js':["+JSON.stringify(client)+",'application/javascript; charset=utf-8'],\n"+
    "      '/studio-next-agents-panel.css':["+JSON.stringify(css)+",'text/css; charset=utf-8'],\n"+
    "      '/studio-next-agents-panel.html':["+JSON.stringify(html)+",'text/html; charset=utf-8']\n"+
    "    };\n"+
    "    if(Object.prototype.hasOwnProperty.call(wayupExtra,assetPath)){\n"+
    "      if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405});\n"+
    "      const entry=wayupExtra[assetPath];\n"+
    "      return new Response(request.method==='HEAD'?null:entry[0],{headers:{'Content-Type':entry[1],'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});\n"+
    "    }\n";
  out=out.replace(methodGuard,prefix+methodGuard);
  const injection='<link rel="stylesheet" href="/studio-next-agents-panel.css"><script src="/studio-next-agents-panel.js" defer></script>';
  const replacement="    const data=request.method==='HEAD'?null:(path==='/'||path==='/index.html'?\n"+
    "      new TextEncoder().encode(new TextDecoder().decode(bytesFor(path)).replace('</body>',"+JSON.stringify(injection)+"+'</body>')):bytesFor(path));";
  out=out.replace(dataLine,replacement);
  out=out.replace(top,"/* WAYUP_STUDIO_AGENT_BRIDGE_V1 */\n"+bridge+"\n"+projectsBridge+"\n"+top);
  if(!out.includes("WAYUP_STUDIO_AGENT_BRIDGE_V1")||!out.includes("wayupExtra")){
    throw Error("El parche no se ha aplicado correctamente.");
  }
  return out;
}

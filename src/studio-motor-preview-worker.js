/* WAY UP Studio · Worker de la preview autorizada (wayup-studio-motor-preview).
 * La app Next.js exportada se sirve como Static Assets; este Worker solo atiende /studio-api/*.
 * Toda la zona está protegida por Cloudflare Access (código por correo): cada puente vuelve a
 * comprobar la identidad mediante ctx.access y nunca confía en cabeceras enviadas por el navegador. */
import {wayupStudioProjectsBridge} from './studio-next-projects-bridge.js';
import {wayupStudioOwnAgentBridge} from './studio-next-own-agents-bridge.js';
import {wayupStudioWebCreatorBridge} from './studio-next-webcreator-bridge.js';

const BUILD_ID=typeof __STUDIO_BUILD__==='string'?__STUDIO_BUILD__:'dev';

function json(value,status=200){
  return new Response(JSON.stringify(value),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'
  }});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/studio-api/')){
      // Identificador del build servido: permite comprobar qué commit está desplegado (sin datos privados).
      if(url.pathname==='/studio-api/build'&&request.method==='GET')return json({build:BUILD_ID});
      try{
        for(const bridge of [wayupStudioProjectsBridge,wayupStudioOwnAgentBridge,wayupStudioWebCreatorBridge]){
          const response=await bridge(request,env,ctx);
          if(response)return response;
        }
      }catch(error){
        console.error('studio-api error',url.pathname,String(error instanceof Error?error.message:error).slice(0,200));
        return json({error:'Error interno de Studio. Vuelve a intentarlo.'},500);
      }
      return json({error:'Ruta no encontrada.'},404);
    }
    return env.ASSETS.fetch(request);
  }
};

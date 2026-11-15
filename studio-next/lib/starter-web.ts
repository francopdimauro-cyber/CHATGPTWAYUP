/**
 * WayUp Studio — constructor local de una web de partida sin API.
 * No ejecuta el briefing, no inventa testimonios ni reseñas ni precios.
 * Es un generador determinista de una plantilla HTML totalmente editable.
 */
export type StarterBrief = {
  name:string;industry:string;audience:string;goal:string;style:string;
  services:string;contact:string;features:string;palette:string;
};
const ESC:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=(v:string)=>String(v||'').replace(/[&<>"']/g,c=>ESC[c]);
const safe=(v:string,n=500)=>esc(v.replace(/\s+/g,' ').trim().slice(0,n));
const colors=(industry:string,style:string)=>{
  const s=(industry+' '+style).toLowerCase();
  if(/gimnas|deport|fitness|entren|crossfit/.test(s))
    return {accent:'#d6ee58',on:'#17210c',bg:'#111912',panel:'#202b20',ink:'#f4f7f0',muted:'#c1caba'};
  if(/restaur|gastron|bar|tapas|cocina|caf[eé]|hotel/.test(s))
    return {accent:'#d9a36f',on:'#2b160e',bg:'#211813',panel:'#34251d',ink:'#fff4e8',muted:'#dac8b9'};
  if(/inmobil|arquitect|interior|boutique|moda/.test(s))
    return {accent:'#d7c4a4',on:'#231d16',bg:'#181b19',panel:'#29302b',ink:'#f9f7f2',muted:'#c8cac5'};
  if(/tech|software|informat|agencia|marketing|digital/.test(s))
    return {accent:'#94adff',on:'#0b1534',bg:'#0e1323',panel:'#202942',ink:'#f2f5ff',muted:'#c1c9e4'};
  return {accent:'#92cabb',on:'#102921',bg:'#13231f',panel:'#22352e',ink:'#f3f8f6',muted:'#c0d1c9'};
};
const serviceList=(v:string):string[]=>{
  const lines=v.split(/\n|;|[•·]/g).map(s=>s.trim()).filter(Boolean);
  if(lines.length>1)return lines.slice(0,6);
  return v.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6);
};
export function starterHtml(input:StarterBrief):string{
  const name=input.name.trim().slice(0,100);
  if(name.length<2)throw Error('Indica el nombre del negocio.');
  const description=input.services.trim();
  if(description.length<20)throw Error('Describe el negocio con al menos 20 caracteres.');
  const sections=serviceList(description);
  const p=colors(input.industry,input.style);
  const blocks=(sections.length>1?sections:[description]).map((service,index)=>
    '<article class="service-card" data-wc-section="servicio-'+(index+1)+'"><span class="card-num">0'+(index+1)+
    '</span><h3>'+safe(service,125)+'</h3><p>Conoce nuestros servicios y contacta con el equipo para recibir información.</p></article>'
  ).join('\n');
  const audience=input.audience.trim()?safe(input.audience,160):'Personas que valoran una atención profesional';
  const goal=input.goal.trim()?safe(input.goal,150):'Descubre cómo podemos ayudarte';
  const contact=input.contact.trim()?'<p>'+safe(input.contact,600)+'</p>':'<p>Consulta disponibilidad y solicita información a nuestro equipo.</p>';
  const imageCaption=input.style.trim()?safe(input.style,140):'Profesional, claro y contemporáneo';
  const title=safe(name,100);
  const desc=safe(description,155);
  return \`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>\${title} | Servicios profesionales</title>
<meta name="description" content="\${desc}">
<style>
:root{--bg:\${p.bg};--panel:\${p.panel};--ink:\${p.ink};--muted:\${p.muted};--accent:\${p.accent};--accent-text:\${p.on};--max:1200px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:inherit}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.wrap{width:min(90%,var(--max));margin:auto}
.site-header{border-bottom:1px solid #ffffff20;position:relative;background:var(--bg)}
.header-row{min-height:86px;display:flex;align-items:center;justify-content:space-between;gap:25px}
.brand{font-size:20px;font-weight:750;letter-spacing:-.045em;text-decoration:none}
.nav{display:flex;flex-wrap:wrap;gap:24px;align-items:center;font-size:13px}
.nav a{text-decoration:none;color:var(--muted)}.nav a:hover{color:var(--accent)}
.chip{color:var(--accent);font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:650}
.hero{display:grid;grid-template-columns:1.3fr .7fr;gap:8%;align-items:center;min-height:640px;padding-block:100px}
h1{font-size:clamp(48px,6.8vw,96px);letter-spacing:-.068em;line-height:1.02;font-weight:710;margin:18px 0 28px}
h2{font-size:clamp(32px,4vw,54px);letter-spacing:-.055em;line-height:1.12;font-weight:680;margin:18px 0 24px}
h3{font-size:22px;letter-spacing:-.03em;line-height:1.2}
.lead{font-size:clamp(16px,1.65vw,20px);max-width:650px;line-height:1.75;color:var(--muted)}
.actions{margin-top:33px;display:flex;gap:14px;flex-wrap:wrap}
.btn{padding:14px 23px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;font-weight:650;font-size:13px;transition:transform .18s}
.btn:hover{transform:translateY(-2px)}.btn-primary{background:var(--accent);color:var(--accent-text)}
.btn-secondary{border:1px solid #ffffff3d;color:var(--ink)}
.editorial-card{min-height:370px;border-radius:18px;border:1px solid #ffffff24;padding:30px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(140deg,#ffffff17,transparent 72%),var(--panel)}
.editorial-card strong{font-size:clamp(30px,4vw,56px);line-height:1.1;letter-spacing:-.055em}
.section{padding:105px 0;border-top:1px solid #ffffff21}
.section-head{display:flex;justify-content:space-between;gap:35px;align-items:end;margin-bottom:45px}
.section-head p{max-width:460px;color:var(--muted)}
.services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.service-card{border:1px solid #ffffff24;background:var(--panel);border-radius:12px;padding:30px;min-height:240px}
.service-card p{font-size:13px;color:var(--muted)}.card-num{font:12px monospace;color:var(--accent)}
.contact{padding:80px 0;display:flex;gap:40px;justify-content:space-between;align-items:center}
.footer{padding:24px 0;border-top:1px solid #ffffff2b;color:var(--muted);font-size:12px}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:28px;padding-block:65px}.editorial-card{min-height:220px}.services{grid-template-columns:1fr 1fr}}
@media(max-width:630px){.header-row{min-height:72px;flex-wrap:wrap;padding-block:18px}.nav{gap:14px}.services{grid-template-columns:1fr}.section{padding:65px 0}.section-head,.contact{display:block}.hero{min-height:auto}.editorial-card{min-height:190px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn{transition:none}}
</style>
</head>
<body>
<header class="site-header" data-wc-section="cabecera"><div class="wrap header-row">
<a class="brand" href="#inicio">\${title}</a>
<nav class="nav" aria-label="Navegación principal"><a href="#inicio">Inicio</a><a href="#servicios">Servicios</a><a href="#contacto">Contacto</a></nav>
</div></header>
<main>
<section class="wrap hero" id="inicio" data-wc-section="inicio">
<div><span class="chip">\${safe(input.industry||'Servicios profesionales',120)}</span>
<h1>\${title}<br><span style="color:var(--accent)">a tu manera.</span></h1>
<p class="lead">\${desc}</p>
<div class="actions"><a class="btn btn-primary" href="#contacto">\${goal}</a><a class="btn btn-secondary" href="#servicios">Nuestros servicios</a></div>
</div>
<div class="editorial-card"><span class="chip">Hecho para ti</span><strong>Una nueva forma de avanzar.</strong><span style="color:var(--muted);font-size:12px">\${audience}</span></div>
</section>
<section class="section" id="servicios" data-wc-section="servicios"><div class="wrap">
<div class="section-head"><div><span class="chip">Qué hacemos</span><h2>Servicios con intención.</h2></div><p>\${desc}</p></div>
<div class="services">\${blocks}</div></div></section>
<section class="section" data-wc-section="filosofia"><div class="wrap">
<span class="chip">Nuestra filosofía</span><h2>El detalle marca<br>la diferencia.</h2>
<p class="lead">\${imageCaption}. \${audience}.</p>
</div></section>
<section class="contact wrap" id="contacto" data-wc-section="contacto">
<div><span class="chip">Hablemos</span><h2>¿Empezamos?</h2>\${contact}</div>
<a class="btn btn-primary" href="mailto:info@ejemplo.invalid" data-wayup-placeholder="true" title="Configura primero una dirección de contacto real">Configurar correo de contacto</a>
</section></main>
<footer class="footer"><div class="wrap">\${title} · Sitio web preparado con WayUp Studio.</div></footer>
</body></html>\`;
}

/* WAY UP Studio · Biblioteca de ejemplos de código por patrón de sección.
   Los modelos pequeños imitan muy bien y diseñan peor: a cada constructor se le entrega un ejemplo
   completo y pulido de su patrón para que lo ADAPTE (textos, marca, variables del director), nunca lo copie tal cual.
   Convenciones: «#ID» se sustituye por el id real de la sección; las variables usan nombres genéricos
   (--bg, --surface, --text, --muted, --accent, --accent-2, --line, --font-display, --font-body, --radius) que el
   constructor debe cambiar por las del CSS base del director. */

const P=[];
const add=(name,match,html,css)=>P.push({name,match,html:html.trim(),css:css.trim()});

add('cabecera',/header|cabecera/i,`
<header class="site-header" data-header>
  <div class="container site-header__bar">
    <a class="brand" href="#inicio" aria-label="Inicio"><span class="brand__mark" aria-hidden="true">◆</span><span class="brand__name">Marca <em>apellido</em></span></a>
    <nav id="menu" class="nav-panel" aria-label="Principal">
      <a href="#servicios">Servicios</a><a href="#metodo">Método</a><a href="#equipo">Equipo</a><a href="#faq">Preguntas</a><a href="#contacto">Contacto</a>
      <a class="btn btn--primary nav-panel__cta" href="#contacto">Reserva tu cita</a>
    </nav>
    <a class="btn btn--primary site-header__cta" href="#contacto">Reserva tu cita</a>
    <button class="nav-toggle" data-menu-toggle aria-controls="menu" aria-expanded="false" aria-label="Abrir menú"><span></span><span></span></button>
  </div>
</header>`,`
.site-header{position:sticky;top:0;z-index:50;transition:background .3s,box-shadow .3s,padding .3s}
.site-header.is-scrolled{background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line)}
.site-header__bar{display:flex;align-items:center;justify-content:space-between;gap:32px;min-height:80px}
.brand{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-display);font-size:20px;color:var(--text);text-decoration:none}
.brand__mark{color:var(--accent)} .brand em{font-style:italic;color:var(--muted)}
.nav-panel{display:flex;align-items:center;gap:30px}
.nav-panel a:not(.btn){position:relative;color:var(--text);text-decoration:none;font-size:15px}
.nav-panel a:not(.btn)::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:1.5px;background:var(--accent);transform:scaleX(0);transform-origin:right;transition:transform .4s cubic-bezier(.2,.8,.2,1)}
.nav-panel a:not(.btn):hover::after{transform:scaleX(1);transform-origin:left}
.nav-panel__cta,.nav-toggle{display:none}
@media (max-width:900px){
  .site-header__cta{display:none}
  .nav-toggle{display:inline-grid;gap:6px;width:44px;height:44px;place-content:center;background:none;border:1px solid var(--line);border-radius:999px}
  .nav-toggle span{display:block;width:18px;height:1.5px;background:var(--text);transition:transform .3s}
  .nav-toggle[aria-expanded="true"] span:first-child{transform:translateY(3.75px) rotate(45deg)}
  .nav-toggle[aria-expanded="true"] span:last-child{transform:translateY(-3.75px) rotate(-45deg)}
  .nav-panel{position:fixed;inset:80px 0 0;flex-direction:column;align-items:flex-start;gap:22px;padding:32px 6%;background:var(--bg);transform:translateY(-8px);opacity:0;visibility:hidden;transition:opacity .3s,transform .3s,visibility .3s}
  .nav-panel.is-open{opacity:1;transform:none;visibility:visible}
  .nav-panel a:not(.btn){font-family:var(--font-display);font-size:32px}
  .nav-panel__cta{display:inline-flex;margin-top:12px}
}`);

add('hero',/hero|portada|inicio|cabecera visual/i,`
<section id="#ID" data-wc-section="#ID" class="hero">
  <div class="container hero__grid">
    <div class="hero__copy">
      <p class="eyebrow" data-reveal>Valladolid · desde 2014</p>
      <h1 class="display" data-reveal>Entrena con <em>criterio</em>, no con prisa</h1>
      <p class="lead" data-reveal>Sesiones de 1 a 4 personas, planificadas por profesionales y adaptadas a tu punto de partida.</p>
      <div class="hero__actions" data-reveal><a class="btn btn--primary" href="#contacto">Reserva tu primera sesión</a><a class="btn btn--ghost" href="#metodo">Ver el método</a></div>
      <ul class="hero__facts" data-reveal-group><li><strong>1:4</strong> máximo por grupo</li><li><strong>60′</strong> por sesión</li><li><strong>[Dato]</strong> que aporte el cliente</li></ul>
    </div>
    <figure class="hero__media" data-reveal><img data-wc-ai-image="personal trainer guiding a woman doing a kettlebell swing in a bright minimalist studio, morning light, editorial" alt="Entrenadora corrigiendo la técnica de una alumna" width="1600" height="2000" loading="eager"></figure>
    <svg class="hero__motif" data-parallax="0.12" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="160" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="200" cy="200" r="110" fill="none" stroke="currentColor" stroke-dasharray="4 8"/></svg>
  </div>
</section>`,`
#ID{position:relative;min-height:min(100svh,940px);display:flex;align-items:center;padding-block:clamp(110px,14vw,170px) clamp(64px,8vw,110px);overflow:hidden}
#ID .hero__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px;align-items:center}
#ID .hero__copy{grid-column:1/span 7;position:relative;z-index:2}
#ID .display{margin:14px 0 22px}
#ID .lead{max-width:34ch}
#ID .hero__actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
#ID .hero__facts{display:flex;gap:36px;margin:48px 0 0;padding:24px 0 0;list-style:none;border-top:1px solid var(--line)}
#ID .hero__facts strong{display:block;font-family:var(--font-display);font-size:clamp(28px,3vw,40px);color:var(--text)}
#ID .hero__facts li{color:var(--muted);font-size:14px}
#ID .hero__media{grid-column:8/span 5;margin:0;border-radius:var(--radius) var(--radius) 999px 999px;overflow:hidden;aspect-ratio:4/5}
#ID .hero__media img{width:100%;height:100%;object-fit:cover}
#ID .hero__motif{position:absolute;right:-120px;top:8%;width:520px;color:var(--accent);opacity:.35;z-index:0}
@media (max-width:900px){#ID .hero__copy,#ID .hero__media{grid-column:1/-1}#ID .hero__media{aspect-ratio:4/3;border-radius:var(--radius)}#ID .hero__facts{gap:20px;flex-wrap:wrap}}`);

add('marquee',/marquee|cinta|banda/i,`
<section id="#ID" data-wc-section="#ID" class="band" aria-label="Lo que nos define">
  <div class="marquee" data-marquee><div class="marquee__track"><span>Fuerza</span><span aria-hidden="true">✦</span><span>Movilidad</span><span aria-hidden="true">✦</span><span>Hábitos</span><span aria-hidden="true">✦</span><span>Constancia</span><span aria-hidden="true">✦</span></div></div>
</section>`,`
#ID{padding-block:28px;background:var(--accent);color:var(--bg);border-block:1px solid var(--line)}
#ID .marquee__track{gap:40px;align-items:center}
#ID .marquee__track span{font-family:var(--font-display);font-size:clamp(36px,6vw,84px);line-height:1;text-transform:uppercase;letter-spacing:-.02em;white-space:nowrap}
#ID .marquee__track span:nth-child(4n+3){-webkit-text-stroke:1.5px currentColor;color:transparent}`);

add('lista numerada',/numerad|lista|índice|indice|servicios/i,`
<section id="#ID" data-wc-section="#ID" class="index-section">
  <div class="container">
    <header class="section-head"><p class="eyebrow" data-reveal>Servicios</p><h2 data-reveal>Cuatro formas de <em>entrenar</em> con nosotros</h2></header>
    <ol class="index" data-reveal-group>
      <li><span class="index__n">01</span><h3>Entrenamiento personal</h3><p>Una sesión, un objetivo, toda la atención del entrenador.</p><span class="index__arrow" aria-hidden="true">→</span></li>
      <li><span class="index__n">02</span><h3>Grupos reducidos</h3><p>Hasta cuatro personas con un plan individual para cada una.</p><span class="index__arrow" aria-hidden="true">→</span></li>
      <li><span class="index__n">03</span><h3>Nutrición</h3><p>Pautas realistas que encajan en tu semana, sin dietas milagro.</p><span class="index__arrow" aria-hidden="true">→</span></li>
    </ol>
  </div>
</section>`,`
#ID .section-head{display:grid;grid-template-columns:repeat(12,1fr);gap:24px;margin-bottom:56px}
#ID .section-head .eyebrow{grid-column:1/span 3} #ID .section-head h2{grid-column:4/span 9;margin:0}
#ID .index{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
#ID .index li{position:relative;display:grid;grid-template-columns:90px 1.2fr 1.5fr 40px;align-items:baseline;gap:24px;padding:34px 12px;border-bottom:1px solid var(--line);transition:background .4s,color .4s}
#ID .index__n{font-family:var(--font-display);color:var(--accent);font-size:18px}
#ID .index h3{margin:0;font-size:clamp(24px,2.6vw,36px)} #ID .index p{margin:0;color:var(--muted)}
#ID .index__arrow{justify-self:end;font-size:22px;transition:transform .4s cubic-bezier(.2,.8,.2,1)}
#ID .index li:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)} #ID .index li:hover .index__arrow{transform:translateX(8px)}
@media (max-width:800px){#ID .section-head .eyebrow,#ID .section-head h2{grid-column:1/-1}#ID .index li{grid-template-columns:56px 1fr;row-gap:8px}#ID .index p{grid-column:2}#ID .index__arrow{display:none}}`);

add('bento',/bento|rejilla|mosaico|ventajas|beneficios/i,`
<section id="#ID" data-wc-section="#ID" class="bento-section">
  <div class="container">
    <h2 class="bento-section__title" data-reveal>Por qué <em>funciona</em></h2>
    <div class="bento" data-reveal-group>
      <article class="bento__item bento__item--xl"><img data-wc-ai-image="small group training session with barbells in an industrial loft gym, warm light, candid" alt="Grupo reducido entrenando" width="1600" height="1100" loading="lazy"><div class="bento__caption"><h3>Grupos de cuatro, como máximo</h3><p>Tienes un entrenador pendiente de cada repetición.</p></div></article>
      <article class="bento__item bento__item--accent"><strong class="bento__big">60′</strong><p>Sesiones que caben en tu día.</p></article>
      <article class="bento__item"><h3>Plan por escrito</h3><p>Sabes qué toca cada semana y por qué.</p></article>
      <article class="bento__item bento__item--wide"><h3>Seguimiento real</h3><p>Medimos, ajustamos y te lo contamos claro.</p></article>
    </div>
  </div>
</section>`,`
#ID .bento-section__title{margin:0 0 48px;max-width:16ch}
#ID .bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(200px,auto);gap:16px}
#ID .bento__item{position:relative;overflow:hidden;padding:28px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);display:flex;flex-direction:column;justify-content:flex-end;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
#ID .bento__item:hover{transform:translateY(-4px)}
#ID .bento__item--xl{grid-column:span 2;grid-row:span 2;padding:0}
#ID .bento__item--xl img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#ID .bento__caption{position:relative;padding:28px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff}
#ID .bento__item--accent{background:var(--accent);color:var(--bg)}
#ID .bento__big{font-family:var(--font-display);font-size:clamp(56px,7vw,104px);line-height:.9}
#ID .bento__item--wide{grid-column:span 2}
#ID h3{margin:0 0 6px} #ID p{margin:0}
@media (max-width:900px){#ID .bento{grid-template-columns:1fr 1fr}#ID .bento__item--xl{grid-column:1/-1;min-height:360px}}
@media (max-width:560px){#ID .bento{grid-template-columns:1fr}#ID .bento__item--wide{grid-column:auto}}`);

add('cifras',/cifra|número|numero|dato|estadística|estadistica/i,`
<section id="#ID" data-wc-section="#ID" class="stats-section">
  <div class="container stats" data-reveal-group>
    <div class="stat"><strong data-count="12" data-suffix=" años">12 años</strong><span>[Dato del cliente: experiencia]</span></div>
    <div class="stat"><strong data-count="4">4</strong><span>Personas como máximo por grupo</span></div>
    <div class="stat"><strong data-count="60" data-suffix="′">60′</strong><span>Por sesión, sin relleno</span></div>
  </div>
</section>`,`
#ID{border-block:1px solid var(--line)}
#ID .stats{display:grid;grid-template-columns:repeat(3,1fr)}
#ID .stat{padding:40px 32px;border-left:1px solid var(--line)} #ID .stat:first-child{border-left:0;padding-left:0}
#ID .stat strong{display:block;font-family:var(--font-display);font-size:clamp(64px,9vw,140px);line-height:.9;letter-spacing:-.04em;color:var(--text)}
#ID .stat span{display:block;margin-top:14px;color:var(--muted);max-width:22ch}
@media (max-width:760px){#ID .stats{grid-template-columns:1fr}#ID .stat{border-left:0;border-top:1px solid var(--line);padding-left:0}#ID .stat:first-child{border-top:0}}`);

add('manifiesto',/manifiesto|cita|frase|filosof/i,`
<section id="#ID" data-wc-section="#ID" class="manifesto">
  <div class="container">
    <p class="eyebrow" data-reveal>Nuestra forma de verlo</p>
    <blockquote data-reveal><p>No buscamos que <em>sufras</em> una hora. Buscamos que vuelvas mañana, y el mes que viene, y dentro de diez años.</p></blockquote>
  </div>
</section>`,`
#ID{padding-block:clamp(110px,15vw,220px)}
#ID blockquote{margin:28px 0 0}
#ID blockquote p{font-family:var(--font-display);font-size:clamp(34px,5.4vw,80px);line-height:1.04;letter-spacing:-.025em;color:var(--text);max-width:22ch;text-wrap:balance}
#ID blockquote em{color:var(--accent)}`);

add('proceso',/proceso|pasos|línea de tiempo|linea de tiempo|método|metodo|cómo funciona|como funciona/i,`
<section id="#ID" data-wc-section="#ID" class="process">
  <div class="container process__grid">
    <div class="process__intro"><p class="eyebrow" data-reveal>Método</p><h2 data-reveal>Así empezamos <em>contigo</em></h2><p class="lead" data-reveal>Tres pasos, sin compromiso de permanencia.</p></div>
    <ol class="steps" data-reveal-group>
      <li><span class="steps__dot" aria-hidden="true"></span><p class="steps__k">Paso 1</p><h3>Valoración inicial</h3><p>Hablamos de tu objetivo, tu historial y tu agenda.</p></li>
      <li><span class="steps__dot" aria-hidden="true"></span><p class="steps__k">Paso 2</p><h3>Plan a medida</h3><p>Diseñamos tus sesiones y te explicamos el porqué.</p></li>
      <li><span class="steps__dot" aria-hidden="true"></span><p class="steps__k">Paso 3</p><h3>Seguimiento</h3><p>Revisamos cada mes y ajustamos lo necesario.</p></li>
    </ol>
  </div>
</section>`,`
#ID .process__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
#ID .process__intro{grid-column:1/span 5;position:sticky;top:120px;align-self:start}
#ID .steps{grid-column:7/span 6;list-style:none;margin:0;padding:0 0 0 32px;border-left:1px solid var(--line)}
#ID .steps li{position:relative;padding:0 0 56px}
#ID .steps__dot{position:absolute;left:-39px;top:6px;width:13px;height:13px;border-radius:50%;background:var(--bg);border:2px solid var(--accent)}
#ID .steps__k{margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
#ID .steps h3{margin:0 0 8px;font-size:clamp(22px,2.4vw,32px)} #ID .steps p{margin:0;color:var(--muted)}
@media (max-width:900px){#ID .process__intro,#ID .steps{grid-column:1/-1;position:static}}`);

add('split',/split|texto e imagen|texto\+imagen|sobre|nosotros|equipo|historia/i,`
<section id="#ID" data-wc-section="#ID" class="split">
  <div class="container split__grid">
    <figure class="split__media" data-reveal><img data-wc-ai-image="portrait of a smiling personal trainer with arms crossed in a calm minimalist gym, soft window light" alt="Retrato del entrenador" width="1400" height="1700" loading="lazy"><figcaption>[Nombre del entrenador] · fundador</figcaption></figure>
    <div class="split__copy">
      <p class="eyebrow" data-reveal>Quiénes somos</p>
      <h2 data-reveal>Un equipo pequeño que te <em>conoce</em> por tu nombre</h2>
      <p data-reveal>Empezamos con una idea sencilla: entrenar bien no debería ser complicado ni intimidante.</p>
      <ul class="checks" data-reveal-group><li>Titulación en ciencias del deporte</li><li>Formación continua cada año</li><li>Trato cercano y directo</li></ul>
      <a class="btn btn--ghost" href="#contacto" data-reveal>Conócenos en persona</a>
    </div>
  </div>
</section>`,`
#ID .split__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px;align-items:center}
#ID .split__media{grid-column:1/span 5;margin:0}
#ID .split__media img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius)}
#ID figcaption{margin-top:12px;font-size:13px;color:var(--muted)}
#ID .split__copy{grid-column:7/span 6}
#ID .checks{list-style:none;padding:0;margin:28px 0 36px;display:grid;gap:12px}
#ID .checks li{display:flex;gap:12px;align-items:baseline} #ID .checks li::before{content:"✓";color:var(--accent);font-weight:700}
@media (max-width:900px){#ID .split__media,#ID .split__copy{grid-column:1/-1}}`);

add('galería',/galer|fotos|instalaciones/i,`
<section id="#ID" data-wc-section="#ID" class="gallery">
  <div class="container"><h2 data-reveal>El <em>espacio</em></h2>
    <div class="gallery__grid" data-reveal-group>
      <figure class="g1"><img data-wc-ai-image="wide view of a modern boutique gym interior with wooden floor and natural light" alt="Sala principal" loading="lazy"></figure>
      <figure class="g2"><img data-wc-ai-image="close-up of chalked hands gripping a barbell, dramatic side light" alt="Detalle de agarre" loading="lazy"></figure>
      <figure class="g3"><img data-wc-ai-image="row of kettlebells on a rack, shallow depth of field, warm tones" alt="Material de entrenamiento" loading="lazy"></figure>
    </div>
  </div>
</section>`,`
#ID .gallery__grid{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:160px;gap:14px;margin-top:40px}
#ID figure{margin:0;overflow:hidden;border-radius:var(--radius)} #ID img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.8,.2,1)}
#ID figure:hover img{transform:scale(1.05)}
#ID .g1{grid-column:span 4;grid-row:span 3} #ID .g2{grid-column:span 2;grid-row:span 2} #ID .g3{grid-column:span 2;grid-row:span 1}
@media (max-width:700px){#ID .gallery__grid{grid-template-columns:1fr 1fr;grid-auto-rows:140px}#ID .g1{grid-column:1/-1;grid-row:span 2}#ID .g2,#ID .g3{grid-column:span 1;grid-row:span 1}}`);

add('testimonios',/testimon|opinion|opinión|reseña|clientes/i,`
<section id="#ID" data-wc-section="#ID" class="quotes">
  <div class="container"><p class="eyebrow" data-reveal>Opiniones</p><h2 data-reveal>Lo que <em>cuentan</em></h2>
    <div class="quotes__grid" data-reveal-group>
      <figure class="quote"><blockquote>“[Testimonio real del cliente: una o dos frases concretas sobre el resultado].”</blockquote><figcaption><span class="quote__avatar" aria-hidden="true">A</span><span><strong>[Nombre]</strong><br>[Contexto, p. ej. alumna desde 2022]</span></figcaption></figure>
      <figure class="quote"><blockquote>“[Segundo testimonio real].”</blockquote><figcaption><span class="quote__avatar" aria-hidden="true">B</span><span><strong>[Nombre]</strong><br>[Contexto]</span></figcaption></figure>
    </div>
  </div>
</section>`,`
#ID .quotes__grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:40px}
#ID .quote{margin:0;padding:36px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);display:flex;flex-direction:column;justify-content:space-between;gap:32px}
#ID blockquote{margin:0;font-family:var(--font-display);font-size:clamp(20px,2vw,26px);line-height:1.35;color:var(--text)}
#ID figcaption{display:flex;align-items:center;gap:14px;font-size:14px;color:var(--muted)}
#ID .quote__avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--accent);color:var(--bg);font-weight:700}
@media (max-width:760px){#ID .quotes__grid{grid-template-columns:1fr}}`);

add('faq',/faq|pregunta|dudas/i,`
<section id="#ID" data-wc-section="#ID" class="faq-section">
  <div class="container faq-section__grid">
    <div><p class="eyebrow" data-reveal>Preguntas frecuentes</p><h2 data-reveal>Antes de <em>empezar</em></h2></div>
    <div class="faq-list" data-reveal-group>
      <details><summary>¿Necesito experiencia previa?</summary><p>No. Adaptamos cada ejercicio a tu nivel desde el primer día.</p></details>
      <details><summary>¿Cuánto cuesta?</summary><p>[Precio o «Te lo contamos en la valoración inicial»].</p></details>
      <details><summary>¿Qué horario tenéis?</summary><p>[Horario aportado por el cliente].</p></details>
    </div>
  </div>
</section>`,`
#ID .faq-section__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
#ID .faq-section__grid>div:first-child{grid-column:1/span 4} #ID .faq-list{grid-column:6/span 7;border-top:1px solid var(--line)}
#ID details{border-bottom:1px solid var(--line)}
#ID summary{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:26px 0;cursor:pointer;list-style:none;font-size:clamp(18px,1.7vw,22px);color:var(--text)}
#ID summary::-webkit-details-marker{display:none}
#ID summary::after{content:"+";font-size:26px;color:var(--accent);transition:transform .35s}
#ID details[open] summary::after{transform:rotate(45deg)}
#ID details p{margin:0 0 26px;color:var(--muted);max-width:60ch}
@media (max-width:900px){#ID .faq-section__grid>div:first-child,#ID .faq-list{grid-column:1/-1}}`);

add('cta',/cta|llamada|contacto final|reserva|a sangre/i,`
<section id="#ID" data-wc-section="#ID" class="cta-block">
  <div class="container cta-block__inner">
    <h2 data-reveal>Tu primera sesión, <em>esta semana</em></h2>
    <p class="lead" data-reveal>Valoración inicial sin compromiso. Te respondemos en menos de 24 horas.</p>
    <div class="cta-block__actions" data-reveal><a class="btn btn--light" href="#contacto">Reservar ahora</a><a class="cta-block__link" href="tel:[Teléfono]">o llama al [Teléfono]</a></div>
  </div>
  <svg class="cta-block__motif" viewBox="0 0 600 600" aria-hidden="true"><circle cx="300" cy="300" r="280" fill="none" stroke="currentColor"/><circle cx="300" cy="300" r="200" fill="none" stroke="currentColor"/></svg>
</section>`,`
#ID{position:relative;overflow:hidden;background:var(--accent);color:var(--bg)}
#ID .cta-block__inner{position:relative;z-index:1;text-align:center;display:grid;justify-items:center;gap:20px}
#ID h2{margin:0;color:var(--bg);font-size:clamp(44px,7vw,104px);line-height:.98;max-width:14ch}
#ID h2 em{font-style:italic}
#ID .lead{color:color-mix(in srgb,var(--bg) 80%,transparent);max-width:44ch}
#ID .cta-block__actions{display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:center;margin-top:12px}
#ID .btn--light{background:var(--bg);color:var(--text)}
#ID .cta-block__link{color:var(--bg);text-decoration:underline;text-underline-offset:4px}
#ID .cta-block__motif{position:absolute;right:-180px;bottom:-220px;width:620px;opacity:.25}`);

add('contacto',/contacto|formulario|ubicaci|dónde|donde/i,`
<section id="#ID" data-wc-section="#ID" class="contact">
  <div class="container contact__grid">
    <div><p class="eyebrow" data-reveal>Contacto</p><h2 data-reveal>Hablemos de tu <em>objetivo</em></h2>
      <dl class="contact__data" data-reveal-group><div><dt>Dirección</dt><dd>[Dirección]</dd></div><div><dt>Teléfono</dt><dd><a href="tel:[Teléfono]">[Teléfono]</a></dd></div><div><dt>Horario</dt><dd>[Horario]</dd></div></dl></div>
    <form class="contact__form" data-reveal>
      <label>Nombre<input name="nombre" autocomplete="name" required></label>
      <label>Correo o teléfono<input name="contacto" required></label>
      <label>¿Qué te gustaría conseguir?<textarea name="mensaje" rows="4"></textarea></label>
      <button class="btn btn--primary" type="submit">Enviar mensaje</button>
    </form>
  </div>
</section>`,`
#ID .contact__grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
#ID .contact__grid>div{grid-column:1/span 5} #ID .contact__form{grid-column:7/span 6}
#ID .contact__data{display:grid;gap:22px;margin:36px 0 0} #ID dt{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)} #ID dd{margin:4px 0 0;font-size:18px}
#ID .contact__form{display:grid;gap:18px;padding:36px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
#ID label{display:grid;gap:8px;font-size:14px;color:var(--muted)}
#ID input,#ID textarea{font:inherit;padding:14px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
#ID input:focus,#ID textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
@media (max-width:900px){#ID .contact__grid>div,#ID .contact__form{grid-column:1/-1}}`);

add('pie',/footer|pie/i,`
<footer class="site-footer">
  <div class="container site-footer__grid">
    <div class="site-footer__brand"><a class="brand" href="#inicio">Marca <em>apellido</em></a><p>Una frase que resuma la promesa de la marca.</p></div>
    <nav aria-label="Pie"><h3>Navegación</h3><a href="#servicios">Servicios</a><a href="#metodo">Método</a><a href="#contacto">Contacto</a></nav>
    <div><h3>Contacto</h3><p>[Dirección]<br><a href="tel:[Teléfono]">[Teléfono]</a><br>[Correo]</p></div>
    <div><h3>Horario</h3><p>[Horario]</p></div>
  </div>
  <div class="container site-footer__legal"><span>© [Año] [Marca]. Todos los derechos reservados.</span><a href="#inicio">Volver arriba ↑</a></div>
</footer>`,`
.site-footer{padding:80px 0 32px;border-top:1px solid var(--line);color:var(--muted)}
.site-footer__grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
.site-footer h3{margin:0 0 14px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--text)}
.site-footer nav{display:grid;gap:10px} .site-footer a{color:inherit;text-decoration:none} .site-footer a:hover{color:var(--accent)}
.site-footer__legal{display:flex;justify-content:space-between;gap:20px;margin-top:64px;padding-top:24px;border-top:1px solid var(--line);font-size:13px}
@media (max-width:800px){.site-footer__grid{grid-template-columns:1fr 1fr}.site-footer__brand{grid-column:1/-1}}
@media (max-width:520px){.site-footer__grid{grid-template-columns:1fr}.site-footer__legal{flex-direction:column}}`);

/** Ejemplo de referencia para un bloque del plan (por id y patrón). Devuelve null si ninguno encaja. */
export function patternExample(id,pattern){
  const key=String(id||'')+' '+String(pattern||'');
  const hit=(id==='cabecera'?P.find(p=>p.name==='cabecera'):id==='pie'?P.find(p=>p.name==='pie'):null)||
    P.find(p=>p.name!=='cabecera'&&p.name!=='pie'&&p.match.test(String(pattern||'')))||
    P.find(p=>p.name!=='cabecera'&&p.name!=='pie'&&p.match.test(key));
  if(!hit)return null;
  const sid=String(id||'seccion');
  return {name:hit.name,html:hit.html.replace(/#ID/g,sid),css:hit.css.replace(/#ID/g,'#'+sid)};
}
export const PATTERN_NAMES=P.map(p=>p.name);

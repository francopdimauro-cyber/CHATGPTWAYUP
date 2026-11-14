/* WAYUP: accessible, persistent theme switch. No dependencies or new model calls. */
(()=>{'use strict';
 const root=document.documentElement;
 const btn=document.getElementById('wcThemeToggle');
 if(!btn)return;
 const key='wc-theme-mode';
 const mode=()=>root.dataset.wcTheme==='dark'?'dark':'light';
 const render=()=>{
   const dark=mode()==='dark';
   btn.setAttribute('aria-pressed',String(dark));
   btn.setAttribute('aria-label',dark?'Activar modo claro WAYUP':'Activar modo oscuro WAYUP');
   const icon=btn.querySelector('.wc-theme-icon'),name=btn.querySelector('.wc-theme-name');
   if(icon)icon.textContent=dark?'☀':'☾';
   if(name)name.textContent=dark?'Claro':'Oscuro';
   const meta=document.querySelector('meta[name="theme-color"]');
   if(meta)meta.setAttribute('content',dark?'#09090b':'#f4f7ff');
 };
 btn.addEventListener('click',()=>{
   const next=mode()==='light'?'dark':'light';
   root.dataset.wcTheme=next;
   try{localStorage.setItem(key,next)}catch{}
   render();
 });
 render();
})();

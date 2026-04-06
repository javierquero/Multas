'use strict';
const T = 20000;
const BASE = 'https://consulta-web.infratrack.com.ar';
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarLanus(browser, tipo, valor) {
  if (tipo==='dni') return {estado:'no_soportado',infracciones:[],mensaje:'Lanús no permite consulta por DNI.'};
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  try {
    await page.goto(`${BASE}/consultas.php?municipio=lanus`,{waitUntil:'networkidle2',timeout:T});
    const captcha = await page.evaluate(()=>document.body.innerText.toLowerCase().includes('captcha')||!!document.querySelector('.g-recaptcha'));
    if (captcha) return {estado:'captcha',infracciones:[],mensaje:'Lanús requiere CAPTCHA.',urlConsulta:`${BASE}/consultas.php?municipio=lanus`};
    const inp = await page.waitForSelector('input[name*="dominio"], input[name*="patente"], input[type="text"]',{timeout:8000});
    await inp.click({clickCount:3});
    await inp.type(clean(valor),{delay:60});
    const btn = await page.$('button[type="submit"], input[type="submit"]');
    if (btn) await btn.click(); else await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const t=document.body.innerText.toLowerCase();return t.includes('acta')||t.includes('infraccion')||t.includes('no se encontr')||t.includes('no posee');},{timeout:15000}).catch(()=>{});
    const r = await page.evaluate(()=>{
      const inf=[];
      document.querySelectorAll('table tbody tr').forEach(f=>{
        const c=[...f.querySelectorAll('td')].map(x=>x.innerText.trim());
        if(c.length>=2&&c.some(x=>x.length>1)) inf.push({acta:c[0]||'—',fecha:c[1]||'—',lugar:c[2]||'—',monto:c[3]||'—',estado:c[4]||'—'});
      });
      const t=document.body.innerText.toLowerCase();
      return {inf,sin:t.includes('no se encontr')||t.includes('sin infr')||t.includes('no posee')};
    });
    return {estado:r.inf.length>0?'con_infracciones':r.sin?'sin_infracciones':'sin_datos',infracciones:r.inf,urlConsulta:`${BASE}/consultas.php?municipio=lanus`};
  } finally { await page.close(); }
}
module.exports = { consultarLanus };

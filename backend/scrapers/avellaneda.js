'use strict';
const T = 20000;
const BASE = 'https://multas.mda.gob.ar';
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarAvellaneda(browser, tipo, valor) {
  if (tipo==='dni') return {estado:'no_soportado',infracciones:[],mensaje:'Avellaneda no permite consulta por DNI.'};
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  try {
    await page.goto(`${BASE}/`,{waitUntil:'networkidle2',timeout:T});
    const inp = await page.waitForSelector('input[name*="dominio"], input[name*="patente"], input[type="text"]',{timeout:10000});
    await inp.click({clickCount:3});
    await inp.type(clean(valor),{delay:60});
    const btn = await page.$('button[type="submit"], input[type="submit"]');
    if (btn) await btn.click(); else await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const t=document.body.innerText.toLowerCase();return t.includes('multa')||t.includes('infraccion')||t.includes('no se encontr')||t.includes('no registra');},{timeout:15000}).catch(()=>{});
    const r = await page.evaluate(()=>{
      const inf=[];
      document.querySelectorAll('table tbody tr').forEach(f=>{
        const c=[...f.querySelectorAll('td')].map(x=>x.innerText.trim());
        if(c.length>=2&&c.some(x=>x.length>1)) inf.push({acta:c[0]||'—',fecha:c[1]||'—',lugar:c[2]||'—',monto:c[3]||'—',estado:c[4]||'—'});
      });
      const t=document.body.innerText.toLowerCase();
      return {inf,sin:t.includes('no se encontr')||t.includes('sin result')||t.includes('no registra')};
    });
    return {estado:r.inf.length>0?'con_infracciones':r.sin?'sin_infracciones':'sin_datos',infracciones:r.inf,urlConsulta:`${BASE}/`};
  } finally { await page.close(); }
}
module.exports = { consultarAvellaneda };

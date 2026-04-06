'use strict';
const T = 20000;
const BASE = 'https://infraccionesba.gba.gob.ar';
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarPBA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  try {
    await page.goto(`${BASE}/consulta-infraccion`,{waitUntil:'networkidle2',timeout:T});
    await page.waitForSelector('input, select',{timeout:10000});
    const sel = await page.$('select[name*="tipo"], select[id*="tipo"]');
    if (sel) await page.select('select[name*="tipo"], select[id*="tipo"]', tipo==='patente'?'DOMINIO':'DNI').catch(()=>{});
    await new Promise(r=>setTimeout(r,500));
    const inpSel = tipo==='patente'
      ? 'input[name*="dominio"], input[placeholder*="dominio"], input[placeholder*="patente"]'
      : 'input[name*="dni"], input[placeholder*="DNI"]';
    const inp = await page.$(inpSel) || await page.$('input[type="text"]');
    if (!inp) throw new Error('Campo no encontrado en PBA');
    await inp.click({clickCount:3});
    await inp.type(tipo==='patente'?clean(valor):valor,{delay:60});
    const btn = await page.$('button[type="submit"], input[type="submit"]');
    if (!btn) throw new Error('Botón no encontrado en PBA');
    await btn.click();
    await page.waitForFunction(()=>{const t=document.body.innerText.toLowerCase();return t.includes('acta')||t.includes('infraccion')||t.includes('no se encontr')||t.includes('no posee');},{timeout:15000}).catch(()=>{});
    const r = await page.evaluate(()=>{
      const inf=[];
      document.querySelectorAll('table tbody tr').forEach(f=>{
        const c=[...f.querySelectorAll('td')].map(x=>x.innerText.trim());
        if(c.length>=2&&c.some(x=>x.length>1)) inf.push({acta:c[0]||'—',fecha:c[1]||'—',lugar:c[2]||'—',monto:c[3]||'—',estado:c[4]||'—'});
      });
      const t=document.body.innerText.toLowerCase();
      return {inf,sin:t.includes('no se encontr')||t.includes('no posee')||t.includes('no registra')};
    });
    return {estado:r.inf.length>0?'con_infracciones':r.sin?'sin_infracciones':'sin_datos',infracciones:r.inf,urlConsulta:`${BASE}/consulta-infraccion`};
  } finally { await page.close(); }
}
module.exports = { consultarPBA };

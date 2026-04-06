'use strict';
const T = 20000;
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarCABA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  try {
    const url = tipo === 'patente'
      ? `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito&dominio=${clean(valor)}`
      : `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: T });
    if (tipo === 'dni') {
      await page.waitForSelector('select, input[placeholder*="documento"]', { timeout: 8000 }).catch(()=>{});
      const sel = await page.$('select');
      if (sel) await page.select('select', 'D').catch(()=>{});
      const inp = await page.$('input[placeholder*="documento"], input[placeholder*="DNI"]');
      if (inp) { await inp.click({clickCount:3}); await inp.type(valor,{delay:50}); }
      const btn = await page.$('button[type="submit"]');
      if (btn) { await btn.click(); await page.waitForNavigation({waitUntil:'networkidle2',timeout:T}).catch(()=>{}); }
    }
    await page.waitForFunction(()=>{const b=document.body.innerText.toLowerCase();return b.includes('infraccion')||b.includes('acta')||b.includes('no se encontr')||b.includes('sin infracc');},{timeout:15000}).catch(()=>{});
    const r = await page.evaluate(()=>{
      const inf=[];
      document.querySelectorAll('table tbody tr').forEach(f=>{
        const c=[...f.querySelectorAll('td')].map(x=>x.innerText.trim());
        if(c.length>=2&&c.some(x=>x.length>1)) inf.push({acta:c[0]||'—',fecha:c[1]||'—',lugar:c[2]||'—',monto:c[3]||'—',estado:c[4]||'—'});
      });
      const t=document.body.innerText.toLowerCase();
      return {inf,sin:t.includes('no se encontr')||t.includes('sin infracc')||t.includes('no registra')||t.includes('sin deuda')};
    });
    return {estado:r.inf.length>0?'con_infracciones':r.sin?'sin_infracciones':'sin_datos',infracciones:r.inf,urlConsulta:url};
  } finally { await page.close(); }
}
module.exports = { consultarCABA };

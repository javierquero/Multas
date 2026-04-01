'use strict';
const TIMEOUT = 20000;
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarCABA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  try {
    const dominio = clean(valor);
    const url = tipo === 'patente'
      ? `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito&dominio=${dominio}`
      : `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    if (tipo === 'dni') {
      await page.waitForSelector('select, input[placeholder*="documento"], input[placeholder*="DNI"]', { timeout: 8000 }).catch(() => {});
      const selectEl = await page.$('select');
      if (selectEl) await page.select('select', 'D').catch(() => {});
      const inputDoc = await page.$('input[placeholder*="documento"], input[placeholder*="DNI"], input[type="number"]');
      if (inputDoc) { await inputDoc.click({ clickCount: 3 }); await inputDoc.type(valor, { delay: 50 }); }
      const btn = await page.$('button[type="submit"], button:not([type="button"])');
      if (btn) { await btn.click(); await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}); }
    }

    await page.waitForFunction(() => {
      const b = document.body.innerText.toLowerCase();
      return b.includes('infraccion') || b.includes('acta') || b.includes('no se encontr') || b.includes('sin infracc') || b.includes('no registra');
    }, { timeout: 15000 }).catch(() => {});

    const resultado = await page.evaluate(() => {
      const infracciones = [];
      document.querySelectorAll('table tbody tr').forEach(fila => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length >= 2) {
          const t = Array.from(celdas).map(c => c.innerText.trim());
          if (t.some(x => x.length > 1)) infracciones.push({ acta: t[0]||'—', fecha: t[1]||'—', lugar: t[2]||'—', monto: t[3]||'—', estado: t[4]||'—' });
        }
      });
      const texto = document.body.innerText.toLowerCase();
      const sinInf = texto.includes('no se encontr') || texto.includes('sin infracc') || texto.includes('no registra') || texto.includes('sin deuda');
      return { infracciones, sinInf };
    });

    return {
      estado: resultado.infracciones.length > 0 ? 'con_infracciones' : resultado.sinInf ? 'sin_infracciones' : 'sin_datos',
      infracciones: resultado.infracciones,
      urlConsulta: url,
    };
  } finally { await page.close(); }
}

module.exports = { consultarCABA };

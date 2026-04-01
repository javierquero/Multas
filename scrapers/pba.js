'use strict';
const TIMEOUT = 20000;
const BASE = 'https://infraccionesba.gba.gob.ar';
function clean(p) { return p.replace(/\s/g,'').toUpperCase(); }

async function consultarPBA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  try {
    await page.goto(`${BASE}/consulta-infraccion`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await page.waitForSelector('input, select', { timeout: 10000 });

    const selectTipo = await page.$('select[name*="tipo"], select[id*="tipo"]');
    if (selectTipo) await page.select('select[name*="tipo"], select[id*="tipo"]', tipo === 'patente' ? 'DOMINIO' : 'DNI').catch(() => {});

    await new Promise(r => setTimeout(r, 500));

    const inputSel = tipo === 'patente'
      ? 'input[name*="dominio"], input[name*="Dominio"], input[placeholder*="dominio"], input[placeholder*="patente"]'
      : 'input[name*="dni"], input[name*="DNI"], input[placeholder*="DNI"]';
    const input = await page.$(inputSel) || await page.$('input[type="text"]');
    if (!input) throw new Error('Campo de busqueda no encontrado en PBA');

    await input.click({ clickCount: 3 });
    await input.type(tipo === 'patente' ? clean(valor) : valor, { delay: 60 });

    const boton = await page.$('button[type="submit"], input[type="submit"]');
    if (!boton) throw new Error('Boton Consultar no encontrado en PBA');
    await boton.click();

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('acta') || t.includes('infraccion') || t.includes('no se encontr') || t.includes('no posee') || t.includes('sin resultado');
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
      const sinInf = texto.includes('no se encontr') || texto.includes('no posee') || texto.includes('no registra') || texto.includes('sin resultado');
      return { infracciones, sinInf };
    });

    return {
      estado: resultado.infracciones.length > 0 ? 'con_infracciones' : resultado.sinInf ? 'sin_infracciones' : 'sin_datos',
      infracciones: resultado.infracciones,
      urlConsulta: `${BASE}/consulta-infraccion`,
    };
  } finally { await page.close(); }
}

module.exports = { consultarPBA };

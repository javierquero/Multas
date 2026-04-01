'use strict';

const TIMEOUT = 20000;
const BASE = 'https://infraccionesba.gba.gob.ar';

function clean(p) { return p.replace(/\s/g, '').toUpperCase(); }

async function consultarPBA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE}/consulta-infraccion`, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Esperar que aparezca el formulario
    await page.waitForSelector('input, select', { timeout: 10000 });

    // Detectar y completar el campo tipo de búsqueda
    const selectTipo = await page.$('select[name*="tipo"], select[name*="Tipo"], select[id*="tipo"]');
    if (selectTipo) {
      const val = tipo === 'patente' ? 'DOMINIO' : 'DNI';
      await page.select('select[name*="tipo"], select[name*="Tipo"], select[id*="tipo"]', val).catch(() => {});
    }

    // Buscar el campo de dominio o DNI
    await page.waitForTimeout(500);

    const inputSel = tipo === 'patente'
      ? 'input[name*="dominio"], input[name*="Dominio"], input[placeholder*="dominio"], input[placeholder*="patente"]'
      : 'input[name*="dni"], input[name*="DNI"], input[placeholder*="DNI"], input[placeholder*="documento"]';

    const input = await page.$(inputSel) || await page.$('input[type="text"]');
    if (!input) throw new Error('No se encontró el campo de búsqueda en PBA');

    await input.click({ clickCount: 3 });
    await input.type(tipo === 'patente' ? clean(valor) : valor, { delay: 60 });

    // Hacer clic en Consultar
    const boton = await page.$('button[type="submit"], input[type="submit"], button:not([type="button"])');
    if (!boton) throw new Error('No se encontró el botón Consultar en PBA');
    await boton.click();

    // Esperar resultados
    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('acta') || t.includes('infraccion') ||
             t.includes('no se encontr') || t.includes('no posee') ||
             t.includes('sin resultado') || t.includes('no registra');
    }, { timeout: 15000 }).catch(() => {});

    // Extraer
    const resultado = await page.evaluate(() => {
      const infracciones = [];
      document.querySelectorAll('table tbody tr').forEach(fila => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length >= 2) {
          const textos = Array.from(celdas).map(c => c.innerText.trim());
          if (textos.some(t => t.length > 1)) {
            infracciones.push({
              acta:   textos[0] || '—',
              fecha:  textos[1] || '—',
              lugar:  textos[2] || '—',
              monto:  textos[3] || '—',
              estado: textos[4] || '—',
            });
          }
        }
      });
      const texto = document.body.innerText.toLowerCase();
      const sinInf = texto.includes('no se encontr') || texto.includes('no posee') ||
                     texto.includes('no registra') || texto.includes('sin resultado');
      return { infracciones, sinInf };
    });

    return {
      estado: resultado.infracciones.length > 0 ? 'con_infracciones' : resultado.sinInf ? 'sin_infracciones' : 'sin_datos',
      infracciones: resultado.infracciones,
      urlConsulta: `${BASE}/consulta-infraccion`,
    };

  } finally {
    await page.close();
  }
}

module.exports = { consultarPBA };

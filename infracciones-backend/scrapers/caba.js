'use strict';

const TIMEOUT = 20000;

function clean(p) { return p.replace(/\s/g, '').toUpperCase(); }

async function consultarCABA(browser, tipo, valor) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });

  try {
    const dominio = clean(valor);
    const url = tipo === 'patente'
      ? `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito&dominio=${dominio}`
      : `https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones/?actas=transito`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Si es por DNI, completar el formulario
    if (tipo === 'dni') {
      // Seleccionar tipo DNI y completar número
      await page.waitForSelector('select, input[placeholder*="documento"], input[placeholder*="DNI"]', { timeout: 8000 }).catch(() => {});
      const selectEl = await page.$('select');
      if (selectEl) await page.select('select', 'D');
      const inputDoc = await page.$('input[placeholder*="documento"], input[placeholder*="DNI"], input[type="number"]');
      if (inputDoc) {
        await inputDoc.click({ clickCount: 3 });
        await inputDoc.type(valor, { delay: 50 });
      }
      const btnConsultar = await page.$('button[type="submit"], button:not([type="button"])');
      if (btnConsultar) {
        await btnConsultar.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {});
      }
    }

    // Esperar a que los resultados carguen (SPA)
    await page.waitForFunction(() => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('infraccion') || body.includes('acta') ||
             body.includes('no se encontr') || body.includes('sin infracc') ||
             body.includes('no registra') || body.includes('no posee');
    }, { timeout: 15000 }).catch(() => {});

    // Extraer datos de la tabla de resultados
    const resultado = await page.evaluate(() => {
      const infracciones = [];

      // Buscar tablas con datos de infracciones
      const filas = document.querySelectorAll('table tbody tr, .infraccion-row, .acta-item, [class*="infraccion"] tr');
      filas.forEach(fila => {
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
      const sinInf = texto.includes('no se encontr') || texto.includes('sin infracc') ||
                     texto.includes('no registra') || texto.includes('no posee') ||
                     texto.includes('no tiene') || texto.includes('sin deuda');

      return { infracciones, sinInf };
    });

    const { infracciones, sinInf } = resultado;
    return {
      estado: infracciones.length > 0 ? 'con_infracciones' : sinInf ? 'sin_infracciones' : 'sin_datos',
      infracciones,
      urlConsulta: url,
    };

  } finally {
    await page.close();
  }
}

module.exports = { consultarCABA };

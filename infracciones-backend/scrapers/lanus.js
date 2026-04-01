'use strict';

const TIMEOUT = 20000;
const BASE = 'https://consulta-web.infratrack.com.ar';

function clean(p) { return p.replace(/\s/g, '').toUpperCase(); }

async function consultarLanus(browser, tipo, valor) {
  if (tipo === 'dni') {
    return { estado: 'no_soportado', infracciones: [], mensaje: 'Lanús no permite consulta por DNI.' };
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE}/consultas.php?municipio=lanus`, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Si hay CAPTCHA de imagen simple, no podemos resolverlo automáticamente
    // pero Infratrack suele tener captchas de texto simples que podemos detectar
    const tieneCaptcha = await page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('captcha') || t.includes('verificación') || !!document.querySelector('canvas, .g-recaptcha, [data-sitekey]');
    });

    if (tieneCaptcha) {
      return {
        estado: 'captcha',
        infracciones: [],
        mensaje: 'El sitio de Lanús requiere CAPTCHA — no es posible consultar automáticamente.',
        urlConsulta: `${BASE}/consultas.php?municipio=lanus`,
      };
    }

    // Encontrar y completar el campo patente
    const inputSel = 'input[name*="dominio"], input[name*="patente"], input[name*="placa"], input[type="text"]';
    const input = await page.waitForSelector(inputSel, { timeout: 8000 });
    await input.click({ clickCount: 3 });
    await input.type(clean(valor), { delay: 60 });

    // Enviar formulario
    const boton = await page.$('button[type="submit"], input[type="submit"], button:not([type="button"])');
    if (boton) {
      await boton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Esperar resultado
    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('acta') || t.includes('infraccion') || t.includes('multa') ||
             t.includes('no se encontr') || t.includes('no posee') || t.includes('sin infr');
    }, { timeout: 15000 }).catch(() => {});

    const resultado = await page.evaluate(() => {
      const infracciones = [];
      document.querySelectorAll('table tbody tr, .resultado tr').forEach(fila => {
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
      const sinInf = texto.includes('no se encontr') || texto.includes('sin infr') ||
                     texto.includes('no posee') || texto.includes('no hay');
      return { infracciones, sinInf };
    });

    return {
      estado: resultado.infracciones.length > 0 ? 'con_infracciones' : resultado.sinInf ? 'sin_infracciones' : 'sin_datos',
      infracciones: resultado.infracciones,
      urlConsulta: `${BASE}/consultas.php?municipio=lanus`,
    };

  } finally {
    await page.close();
  }
}

module.exports = { consultarLanus };

'use strict';
const express   = require('express');
const cors      = require('cors');
const puppeteer = require('puppeteer');
const { consultarCABA }       = require('./scrapers/caba');
const { consultarPBA }        = require('./scrapers/pba');
const { consultarLanus }      = require('./scrapers/lanus');
const { consultarAvellaneda } = require('./scrapers/avellaneda');

const app  = express();
const PORT = process.env.PORT || 3000;

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--lang=es-AR'],
    });
  }
  return browser;
}

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (_, res) => res.json({ status: 'ok', service: 'infracciones-ar' }));

app.post('/consultar', async (req, res) => {
  const { tipo, valor, sitios } = req.body;
  if (!tipo || !valor || !sitios?.length) return res.status(400).json({ error: 'Faltan parámetros' });

  const SCRAPERS = { caba: consultarCABA, pba: consultarPBA, lanus: consultarLanus, avellaneda: consultarAvellaneda };
  const META = {
    caba:       { nombre: 'Ciudad de Buenos Aires',    emoji: '🏙', org: 'GCBA' },
    pba:        { nombre: 'Provincia de Buenos Aires', emoji: '🌾', org: 'InfraccionesBA' },
    lanus:      { nombre: 'Municipio de Lanús',        emoji: '🏘', org: 'Infratrack' },
    avellaneda: { nombre: 'Municipio de Avellaneda',   emoji: '🏗', org: 'MDA Multas' },
  };

  try {
    const b = await getBrowser();
    const resultados = await Promise.all(
      sitios.filter(id => SCRAPERS[id]).map(async id => {
        try {
          const r = await SCRAPERS[id](b, tipo, valor);
          return { id, ...META[id], ...r };
        } catch (err) {
          return { id, ...META[id], estado: 'error', infracciones: [], error: err.message };
        }
      })
    );
    res.json({ ok: true, resultados });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
process.on('SIGTERM', async () => { if (browser) await browser.close(); process.exit(0); });

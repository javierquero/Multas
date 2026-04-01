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

let browserPool = null;

async function getBrowser() {
  if (!browserPool || !browserPool.isConnected()) {
    browserPool = await puppeteer.launch({
      headless: 'new',
      // En Docker (Railway) usa Chromium del sistema; localmente usa el de Puppeteer
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--lang=es-AR,es',
      ],
    });
  }
  return browserPool;
}

app.use(cors({ origin: '*', methods: ['GET','POST'] }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', service: 'infracciones-ar' });
});

app.post('/consultar', async (req, res) => {
  const { tipo, valor, sitios } = req.body;
  if (!tipo || !valor || !sitios || !sitios.length) {
    return res.status(400).json({ error: 'Faltan parametros: tipo, valor, sitios' });
  }

  const SCRAPERS = {
    caba:       consultarCABA,
    pba:        consultarPBA,
    lanus:      consultarLanus,
    avellaneda: consultarAvellaneda,
  };

  const META = {
    caba:       { nombre: 'Ciudad de Buenos Aires',    emoji: '🏙', org: 'GCBA' },
    pba:        { nombre: 'Provincia de Buenos Aires', emoji: '🌾', org: 'InfraccionesBA' },
    lanus:      { nombre: 'Municipio de Lanus',        emoji: '🏘', org: 'Infratrack' },
    avellaneda: { nombre: 'Municipio de Avellaneda',   emoji: '🏗', org: 'MDA Multas' },
  };

  try {
    const browser = await getBrowser();

    const tareas = sitios.filter(id => SCRAPERS[id]).map(async id => {
      const meta = META[id];
      try {
        const result = await SCRAPERS[id](browser, tipo, valor);
        return { id, ...meta, ...result };
      } catch (err) {
        console.error(`[${id}]`, err.message);
        return { id, ...meta, estado: 'error', infracciones: [], error: err.message };
      }
    });

    const resultados = await Promise.all(tareas);
    res.json({ ok: true, resultados });

  } catch (err) {
    console.error('Error general:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Puerto ${PORT}`));

process.on('SIGTERM', async () => {
  if (browserPool) await browserPool.close();
  process.exit(0);
});

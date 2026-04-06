'use strict';

const SITIOS = [
  { id:'caba',       nombre:'Ciudad de Buenos Aires',    sigla:'CABA', emoji:'🏙', org:'GCBA · Infracciones',      soporta:['patente','dni'] },
  { id:'pba',        nombre:'Provincia de Buenos Aires', sigla:'PBA',  emoji:'🌾', org:'InfraccionesBA · Pcia.',    soporta:['patente','dni'] },
  { id:'lanus',      nombre:'Municipio de Lanús',        sigla:'LNS',  emoji:'🏘', org:'Infratrack',                soporta:['patente'] },
  { id:'avellaneda', nombre:'Municipio de Avellaneda',   sigla:'AVE',  emoji:'🏗', org:'MDA Multas',                soporta:['patente'] },
];

const BADGES = {
  con_infracciones: { cls:'dng',  lbl:'Con infracciones' },
  sin_infracciones: { cls:'ok',   lbl:'Sin infracciones' },
  sin_datos:        { cls:'mute', lbl:'Sin datos' },
  no_soportado:     { cls:'mute', lbl:'No disponible' },
  captcha:          { cls:'warn', lbl:'CAPTCHA' },
  error:            { cls:'warn', lbl:'Error' },
};

let tab      = 'patente';
let selected = new Set(SITIOS.map(s => s.id));
let busy     = false;
let backendUrl = localStorage.getItem('backendUrl') || '';

// ── Utils ─────────────────────────────────────────────────────────────────────

function clean(p)  { return p.replace(/\s/g,'').toUpperCase(); }
function fmt(p) {
  const c = clean(p);
  if (/^[A-Z]{3}\d{3}$/.test(c))         return c.slice(0,3)+' '+c.slice(3);
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c)) return c.slice(0,2)+' '+c.slice(2,5)+' '+c.slice(5);
  return c;
}
function validP(p) { const c=clean(p); return /^[A-Z]{3}\d{3}$/.test(c)||/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c); }
function validD(d) { return /^\d{7,9}$/.test(d.trim()); }

function showErr(id, msg) { const e=document.getElementById(id); e.textContent=msg; }
function hideErr(id)      { document.getElementById(id).textContent=''; }

function setResults(html) { document.getElementById('results-section').innerHTML = html; }

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(t) {
  tab = t;
  document.getElementById('tab-patente').classList.toggle('active', t==='patente');
  document.getElementById('tab-dni').classList.toggle('active',     t==='dni');
  document.getElementById('panel-patente').style.display = t==='patente' ? '' : 'none';
  document.getElementById('panel-dni').style.display     = t==='dni'     ? '' : 'none';
  buildChips();
  resetResults();
}

function resetResults() {
  setResults(`<div class="idle-state" id="idle-state">
    <div class="idle-icon">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.3"/>
        <circle cx="24" cy="24" r="8" stroke="currentColor" stroke-width="1" opacity="0.4"/>
        <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.5"/>
      </svg>
    </div>
    <p class="idle-title">Ingresá una patente o DNI</p>
    <p class="idle-sub">Los resultados de todas las jurisdicciones aparecen aquí</p>
  </div>`);
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function buildChips() {
  const grid = document.getElementById('juris-grid');
  grid.innerHTML = '';
  SITIOS.forEach(s => {
    const sup  = s.soporta.includes(tab);
    const isel = selected.has(s.id) && sup;
    const chip = document.createElement('div');
    chip.className = 'juris-chip' + (isel?' sel':'') + (!sup?' dis':'');
    chip.innerHTML = `
      <span class="jc-emoji">${s.emoji}</span>
      <div class="jc-info">
        <div class="jc-name">${s.nombre}</div>
        <div class="jc-sub">${s.sigla}${!sup?' · no disponible':''}</div>
      </div>
      <div class="jc-check">${isel?'✓':''}</div>`;
    if (sup && !busy) {
      chip.addEventListener('click', () => {
        selected.has(s.id) ? selected.delete(s.id) : selected.add(s.id);
        buildChips();
      });
    }
    grid.appendChild(chip);
  });
}

function selectAll() { SITIOS.forEach(s=>{if(s.soporta.includes(tab)) selected.add(s.id);}); buildChips(); }
function clearAll()  { selected.clear(); buildChips(); }

// ── Busy ──────────────────────────────────────────────────────────────────────

function setBusy(b) {
  busy = b;
  ['btn-consultar-pat','btn-consultar-dni'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = b;
  });
  buildChips();
}

// ── Loading ───────────────────────────────────────────────────────────────────

function mostrarCargando(sitioIds, displayVal) {
  const meta = Object.fromEntries(SITIOS.map(s=>[s.id,s]));
  const rows = sitioIds.map(id => {
    const s = meta[id];
    return `<div class="prog-item" id="prog-${id}">
      <span class="prog-emoji">${s.emoji}</span>
      <div class="prog-info">
        <div class="prog-name">${s.nombre}</div>
        <div class="prog-status" id="pst-${id}">Consultando…</div>
      </div>
      <div class="prog-dot loading" id="pdot-${id}"></div>
    </div>`;
  }).join('');

  setResults(`
    <div class="loading-header">
      <div class="spinner"></div>
      <span class="loading-txt">Consultando "${displayVal}"…</span>
    </div>
    <div class="prog-list">${rows}</div>`);
}

function actualizarProgreso(id, estado) {
  const dot = document.getElementById(`pdot-${id}`);
  const st  = document.getElementById(`pst-${id}`);
  if (!dot || !st) return;
  dot.className = 'prog-dot ' + (estado === 'error' ? 'error' : 'done');
  const labels = {
    con_infracciones: 'Con infracciones',
    sin_infracciones: 'Sin infracciones',
    captcha: 'CAPTCHA requerido',
    error: 'Error al consultar',
    no_soportado: 'No disponible',
    sin_datos: 'Sin datos',
  };
  st.textContent = labels[estado] || estado;
}

// ── Consultar ─────────────────────────────────────────────────────────────────

async function buscar(tipo) {
  if (busy) return;

  if (!backendUrl) {
    document.querySelector('.config-bar').classList.add('open');
    document.getElementById('backend-url').focus();
    return;
  }

  const isP   = tipo === 'patente';
  const inpId = isP ? 'inp-patente' : 'inp-dni';
  const errId = isP ? 'err-patente' : 'err-dni';
  const valor = document.getElementById(inpId).value.trim();
  hideErr(errId);

  if (!valor)               { showErr(errId, '⚠ Ingresá una ' + (isP?'patente.':'DNI.')); return; }
  if (isP && !validP(valor)){ showErr(errId, '⚠ Formato inválido. Ej: ABC123 o AB123CD'); return; }
  if (!isP && !validD(valor)){ showErr(errId, '⚠ El DNI debe tener 7-9 dígitos, sin puntos.'); return; }

  const sitios = SITIOS.filter(s => selected.has(s.id) && s.soporta.includes(tipo)).map(s=>s.id);
  if (!sitios.length) { showErr(errId, '⚠ Seleccioná al menos una jurisdicción.'); return; }

  const displayVal = isP ? fmt(valor) : valor;
  setBusy(true);
  mostrarCargando(sitios, displayVal);

  try {
    const resp = await fetch(`${backendUrl}/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor: clean(valor), sitios }),
    });

    if (!resp.ok) throw new Error(`El backend respondió con error ${resp.status}`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido del backend');

    data.resultados.forEach(r => actualizarProgreso(r.id, r.estado));
    await new Promise(r => setTimeout(r, 500));

    mostrarResultados(data.resultados, displayVal, isP);

  } catch (err) {
    setResults(`<div class="idle-state">
      <div class="idle-icon" style="color:var(--accent);opacity:0.6">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5"/>
          <path d="M24 14v14M24 32v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="idle-title">Error de conexión</p>
      <p class="idle-sub">${err.message}</p>
    </div>`);
  } finally {
    setBusy(false);
  }
}

// ── Render resultados ─────────────────────────────────────────────────────────

function mostrarResultados(data, displayVal, isP) {
  const conInf = data.filter(r=>r.estado==='con_infracciones').length;

  const cards = data.map(r => {
    const b = BADGES[r.estado] || BADGES.sin_datos;
    return `<div class="rcard">
      <div class="rcard-head">
        <div class="rcard-identity">
          <div class="rcard-emoji">${r.emoji}</div>
          <div>
            <div class="rcard-name">${r.nombre}</div>
            <div class="rcard-org">${r.org}</div>
          </div>
        </div>
        <span class="badge ${b.cls}"><span class="badge-dot"></span>${b.lbl}</span>
      </div>
      <div class="rcard-body">${cuerpo(r, isP)}</div>
    </div>`;
  }).join('');

  setResults(`
    <div class="results-header">
      <span class="results-title">"${displayVal}"</span>
      <span class="results-meta">${data.length} sitio${data.length>1?'s':''} · ${conInf} con infracc.</span>
    </div>
    <div class="results-list">${cards}</div>`);

  document.querySelectorAll('.btn-ver[data-url]').forEach(btn => {
    btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank'));
  });
}

function cuerpo(r, isP) {
  let h = '';
  if (r.estado === 'con_infracciones' && r.infracciones?.length) {
    const filas = r.infracciones.map(i => `<tr>
      <td class="td-acta">${i.acta}</td>
      <td>${i.fecha}</td>
      <td>${i.lugar}</td>
      <td class="td-monto">${i.monto}</td>
      <td>${i.estado}</td>
    </tr>`).join('');
    h += `<table class="inf-table">
      <thead><tr><th>Acta</th><th>Fecha</th><th>Lugar</th><th>Monto</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
  } else if (r.estado === 'sin_infracciones') {
    h += `<div class="estado-box sin">✓ Sin infracciones registradas para este ${isP?'dominio':'DNI'}.</div>`;
  } else if (r.estado === 'captcha') {
    h += `<div class="estado-box cap">⚠ ${r.mensaje || 'El sitio requiere CAPTCHA — no es posible consultar automáticamente.'}</div>`;
  } else if (r.estado === 'error') {
    h += `<div class="estado-box fail">⚠ ${r.error || 'Error al conectar con el sitio.'}</div>`;
  } else if (r.estado === 'no_soportado') {
    h += `<div class="estado-box nada">${r.mensaje || 'Este sitio no admite este tipo de búsqueda.'}</div>`;
  } else {
    h += `<div class="estado-box nada">No se pudo interpretar la respuesta del sitio.</div>`;
  }
  if (r.urlConsulta) {
    h += `<div style="margin-top:10px"><button class="btn-ver" data-url="${r.urlConsulta}">Ver sitio oficial ↗</button></div>`;
  }
  return h;
}

// ── Config ────────────────────────────────────────────────────────────────────

function initConfig() {
  const toggle  = document.getElementById('config-toggle');
  const bar     = document.querySelector('.config-bar');
  const input   = document.getElementById('backend-url');
  const saveBtn = document.getElementById('config-save');
  const status  = document.getElementById('config-status');

  input.value = backendUrl;

  toggle.addEventListener('click', () => bar.classList.toggle('open'));

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim().toLowerCase().replace(/\/$/, '');
    localStorage.setItem('backendUrl', url);
    backendUrl = url;
    status.textContent = '✓ Guardado';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
  document.addEventListener('click', e => {
    if (!bar.contains(e.target) && e.target !== toggle) bar.classList.remove('open');
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.getElementById('tab-patente').addEventListener('click', () => switchTab('patente'));
  document.getElementById('tab-dni').addEventListener('click', () => switchTab('dni'));

  // Consultar
  document.getElementById('btn-consultar-pat').addEventListener('click', () => buscar('patente'));
  document.getElementById('btn-consultar-dni').addEventListener('click', () => buscar('dni'));

  // Input patente — uppercase
  const inpPat = document.getElementById('inp-patente');
  inpPat.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
  inpPat.addEventListener('keydown', e => { if (e.key === 'Enter') buscar('patente'); });

  // Input DNI — solo números
  const inpDni = document.getElementById('inp-dni');
  inpDni.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  inpDni.addEventListener('keydown', e => { if (e.key === 'Enter') buscar('dni'); });

  // Jurisdicciones
  document.getElementById('btn-all').addEventListener('click', selectAll);
  document.getElementById('btn-none').addEventListener('click', clearAll);

  // Config
  initConfig();

  // Build inicial
  buildChips();
});

// Interactividad de la sección de especies: búsqueda, filtros por grupo,
// modal de ficha y carga de fotos desde la API de Wikipedia.
// Las tarjetas llegan renderizadas desde el servidor; aquí solo se
// muestran/ocultan y se rellena el modal.
import { svgIcon } from '../data/icons.js';

const ESPECIES = JSON.parse(document.getElementById('especies-data').textContent);
const grid = document.getElementById('grid-especies');

const iconoGrupo = (grupo, size) =>
  svgIcon(grupo === 'cefalopodos' ? 'shell' : 'fish', { size, stroke: 1.5 });

/* IMÁGENES (Wikipedia REST API, con fallback a la foto estática) */
const imgCache = {};
const imgInFlight = {};

async function fetchWikiImage(esp) {
  if (imgCache[esp.id] !== undefined) return imgCache[esp.id];
  if (imgInFlight[esp.id]) return imgInFlight[esp.id];
  const slug = esp.cientifico.replace(/ /g, '_');
  const candidatos = [
    `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
  ];
  imgInFlight[esp.id] = (async () => {
    for (const url of candidatos) {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!r.ok) continue;
        const data = await r.json();
        const src = data?.originalimage?.source || data?.thumbnail?.source;
        if (src) { imgCache[esp.id] = src; return src; }
      } catch (_) {}
    }
    imgCache[esp.id] = null;
    return null;
  })();
  return imgInFlight[esp.id];
}

function ponerPlaceholder(contenedor, claseImg, grupo) {
  const size = claseImg === 'modal-img' ? 48 : 32;
  contenedor.innerHTML = `<div class="${claseImg} placeholder">${iconoGrupo(grupo, size)}</div>`;
}

async function cargarImagenEspecie(esp, contenedor, claseImg) {
  let src = await fetchWikiImage(esp);
  if (!src) src = esp.foto || null;
  if (!contenedor.isConnected) return;
  if (!src) {
    ponerPlaceholder(contenedor, claseImg, esp.grupo);
    return;
  }
  const img = document.createElement('img');
  img.className = claseImg;
  img.src = src;
  img.alt = esp.nombre;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => ponerPlaceholder(contenedor, claseImg, esp.grupo));
  contenedor.replaceChildren(img);
}

ESPECIES.forEach((esp) => {
  const wrap = grid.querySelector(`.card-img-wrap[data-img="${esp.id}"]`);
  if (wrap) cargarImagenEspecie(esp, wrap, 'card-img');
});

/* BÚSQUEDA Y FILTROS */
let filtroActual = 'todas';

function aplicarFiltro() {
  const q = document.getElementById('buscador').value.trim().toLowerCase();
  grid.querySelectorAll('.card').forEach((card) => {
    const coincideGrupo = filtroActual === 'todas' || card.dataset.grupo === filtroActual;
    const coincideTexto = !q || card.dataset.busqueda.includes(q);
    card.classList.toggle('hidden', !(coincideGrupo && coincideTexto));
  });
}

document.getElementById('buscador').addEventListener('input', aplicarFiltro);
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    filtroActual = chip.dataset.filtro;
    aplicarFiltro();
  });
});

/* MODAL */
const modal = document.getElementById('modal');
const modalImgWrap = document.getElementById('modal-img-wrap');
const modalTit = document.getElementById('modal-titulo');
const modalCient = document.getElementById('modal-cientifico');
const modalCat = document.getElementById('modal-catalan');
const modalWarn = document.getElementById('modal-warn-wrap');
const modalFicha = document.getElementById('modal-ficha');
const modalCredit = document.getElementById('modal-credit');

function abrirEspecie(id) {
  const e = ESPECIES.find((x) => x.id === id);
  if (!e) return;

  ponerPlaceholder(modalImgWrap, 'modal-img', e.grupo);
  cargarImagenEspecie(e, modalImgWrap, 'modal-img');

  modalTit.textContent = e.nombre;
  modalCient.textContent = e.cientifico;
  modalCat.textContent = `CA: ${e.catalan}`;
  modalCredit.textContent = 'Foto: Wikipedia / Wikimedia Commons';

  let warnHtml = '';
  if (e.verificado === false) {
    warnHtml += `<div class="modal-warn">${svgIcon('warn')}<div><strong>Información parcialmente sin contrastar:</strong> Alguno de los datos de esta ficha no se ha podido confirmar al 100% con fuentes oficiales. Verifica antes de actuar sobre la base de esta información.</div></div>`;
  }
  if (e.nota) {
    warnHtml += `<div class="modal-warn modal-warn-info">${svgIcon('info')}<div><strong>Nota:</strong> ${e.nota}</div></div>`;
  }
  modalWarn.innerHTML = warnHtml;

  const filas = [
    ['Aspecto', e.aspecto],
    ['Hábitat', e.habitat],
    ['Alimentación', e.alimentacion],
    ['Peso (rango)', e.pesoRango],
    ['Talla mínima legal', e.tallaMinima],
    ['Cuota diaria', e.cuota],
    ['Época', e.epoca],
    ['Carne / valor culinario', e.carne],
    ['Dificultad', e.dificultad],
    ['Técnica recomendada', e.tecnica],
  ];
  modalFicha.innerHTML = filas
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `<div class="ficha-row"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-close').focus();
}

function cerrarModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) cerrarModal();
});

document.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) { abrirEspecie(card.dataset.id); return; }
  const tag = e.target.closest('.tag');
  if (tag) { abrirEspecie(tag.dataset.id); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement?.classList.contains('card')) {
    abrirEspecie(document.activeElement.dataset.id);
  }
});

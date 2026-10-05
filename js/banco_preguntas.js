import { db } from './common/db.js';
import { renderHeader, showToast, showModal } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { TOPICS, escapeHtml } from './common/utils.js';
import { CURRICULUM } from './common/boja-data.js';

let allPreguntas = [];
let currentPage = 1;
const pageSize = 100;
const selectedIds = new Set();

function init() {
  requireAuth({
    allowedRoles: ['teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      renderHeader(user, profile);
      setupListeners();
      await loadPreguntas();
    }
  });
}

function setupListeners() {
  populateTopics();
  document.getElementById('filter-topic').addEventListener('change', onFilterChange);
  document.getElementById('filter-text').addEventListener('input', onFilterChange);
  
  document.getElementById('btn-prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPreguntas(); } });
  document.getElementById('btn-next-page').addEventListener('click', () => { currentPage++; renderPreguntas(); });

  document.getElementById('chk-all').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.chk-row').forEach(chk => {
      chk.checked = isChecked;
      if (isChecked) selectedIds.add(chk.value);
      else selectedIds.delete(chk.value);
    });
    updateSelectionUI();
  });

  document.getElementById('btn-nueva-pregunta').addEventListener('click', () => {
    document.getElementById('form-pregunta').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('modal-pregunta-title').innerText = 'Nueva Pregunta';
    document.getElementById('modal-pregunta').classList.add('modal-backdrop--visible');
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('modal-pregunta').classList.remove('modal-backdrop--visible');
  });
  document.getElementById('btn-cancel-modal').addEventListener('click', () => {
    document.getElementById('modal-pregunta').classList.remove('modal-backdrop--visible');
  });

  document.getElementById('form-pregunta').addEventListener('submit', async (e) => {
    e.preventDefault();
    await savePregunta();
  });

  document.getElementById('btn-delete-selected').addEventListener('click', deleteSelected);
  
  document.getElementById("btn-import-json").addEventListener("click", () => document.getElementById("file-import-json").click());
  document.getElementById("file-import-json").addEventListener("change", importJson);

  document.getElementById('btn-show-coverage').addEventListener('click', showCoverage);
  document.getElementById('btn-close-cobertura').addEventListener('click', () => {
    document.getElementById('modal-cobertura').classList.remove('modal-backdrop--visible');
  });
}

function populateTopics() {
  const filterSelect = document.getElementById('filter-topic');
  const formSelect = document.getElementById('p-topic');
  
  let html = '';
  for (const key in TOPICS) {
    html += `<option value="${key}">${TOPICS[key].name}</option>`;
  }
  
  if(filterSelect) filterSelect.innerHTML += html;
  if(formSelect) formSelect.innerHTML = html;
}

async function loadPreguntas() {
  try {
    const q = collection(db, "preguntas");
    const snap = await getDocs(q);
    allPreguntas = snap.docs.map(d => {
      const data = d.data();
      if (data.topic === 'topic_audacity' || data.topic === 'topic_gimp' || data.topic === 'topic_audio' || data.topic === 'topic_image') {
         data.topic = 'topic_multimedia';
      }
      if (data.topic === 'topic_wordpress' || data.topic === 'topic_wiki') {
         data.topic = 'topic_cms';
      }
      if (data.topic === 'topic_algoritmos') {
         data.topic = 'topic_js';
      }
      if (data.topic === 'topic_cert') {
         data.topic = 'topic_cyber';
      }
      if (data.topic === 'topic_accesibilidad') {
         data.topic = 'topic_html';
      }
      if (data.topic === 'topic_seo') {
         data.topic = 'topic_cms';
      }
      if (data.topic === 'topic_ingenieria' || data.topic === 'topic_industria') {
         data.topic = 'topic_kanban';
      }
      if (data.topic === 'topic_cc') {
         data.topic = 'topic_multimedia';
      }
      if (['topic_sheets', 'topic_docs', 'topic_slides'].includes(data.topic)) {
         data.topic = 'topic_drive';
      }
      return { id: d.id, ...data };
    });
    allPreguntas.sort((a, b) => { 
      const tA = a.topic || '';
      const tB = b.topic || '';
      return tA.localeCompare(tB);
    });
    renderPreguntas();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar preguntas', 'error');
  }
}

function updateSelectionUI() {
  const counter = document.getElementById('delete-count');
  if (counter) counter.innerText = selectedIds.size;
  
  const btn = document.getElementById('btn-delete-selected');
  // Only update disabled state if we are not currently in the middle of a deletion
  if (btn && btn.innerText.indexOf('Borrando') === -1) {
    btn.disabled = selectedIds.size === 0;
  }
  
  const chkRows = Array.from(document.querySelectorAll('.chk-row'));
  const allChecked = chkRows.length > 0 && chkRows.every(chk => chk.checked);
  
  const chkAll = document.getElementById('chk-all');
  if (chkAll) chkAll.checked = allChecked;
}

const onFilterChange = () => { currentPage = 1; renderPreguntas(); };

function renderPreguntas() {
  const container = document.getElementById('preguntas-list');
  const topicF = document.getElementById('filter-topic').value;
  const textF = document.getElementById('filter-text').value.toLowerCase();

  window.currentFilteredPreguntas = allPreguntas.filter(p => {
    if (topicF && p.topic !== topicF) return false;
    if (textF && !p.enunciado.toLowerCase().includes(textF)) return false;
    return true;
  });

  const total = window.currentFilteredPreguntas.length;
  const maxPages = Math.ceil(total / pageSize) || 1;
  if (currentPage > maxPages) currentPage = maxPages;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  
  document.getElementById('page-info').innerText = total === 0 ? 'Sin resultados' : `Mostrando ${startIndex + 1} - ${endIndex} de ${total}`;
  document.getElementById('btn-prev-page').disabled = currentPage === 1;
  document.getElementById('btn-next-page').disabled = currentPage === maxPages;

  if (total === 0) {
    container.innerHTML = '<div style="padding: var(--space-6); text-align: center; color: var(--text-muted);">No hay preguntas que coincidan.</div>';
    return;
  }

  const paginated = window.currentFilteredPreguntas.slice(startIndex, endIndex);

  container.innerHTML = paginated.map(p => {
    const dif = p.dificultad || 'media';
    let diffColor = 'success';
    if(dif === 'media') diffColor = 'warning';
    if(dif === 'alta') diffColor = 'danger';
    
    const correctaText = p.opciones?.find(o => o.correcta)?.texto || '?';
    const topicName = TOPICS[p.topic]?.name || p.topic || 'Sin bloque';

    return `
      <div class="question-row">
        <div><input class="chk-row" type="checkbox" value="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}></div>
        <div style="overflow: hidden; text-overflow: ellipsis;"><span class="badge badge--primary" style="font-size:0.7em; white-space: normal; display: inline-block; line-height: 1.2; padding: 4px; text-align: center;">${escapeHtml(topicName)}</span></div>
        <div>CE ${p.ce || '-'}</div>
        <div style="color: var(--primary); font-weight: bold; font-size: 1.1em;">${p.criterio || '-'}</div>
        <div style="overflow: hidden;">
          <div class="question-text" title="${p.enunciado.replace(/"/g, '&quot;')}">${p.enunciado}</div>
          <div style="font-size: var(--text-xs); color: var(--success); margin-top: 4px;">✓ ${correctaText}</div>
        </div>
        <div><span class="badge badge--${diffColor}">${dif}</span></div>
        <div style="text-align: right; display: flex; gap: 4px; justify-content: flex-end;">
          <button class="btn btn-ghost btn--sm" onclick="window.editPregunta('${p.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn--sm" onclick="window.deletePregunta('${p.id}')" title="Borrar">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.chk-row').forEach(chk => {
    chk.addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(e.target.value);
      else selectedIds.delete(e.target.value);
      updateSelectionUI();
    });
  });
  updateSelectionUI();
}

async function savePregunta() {
  const id = document.getElementById('p-id').value;
  const opcionesInputs = document.querySelectorAll('.p-opcion');
  const correctRadio = document.querySelector('.p-correcta:checked');
  
  if(!correctRadio) {
    showToast('Debes marcar una opción como correcta', 'warning');
    return;
  }
  
  const opciones = Array.from(opcionesInputs).map((input, idx) => ({
    texto: input.value,
    correcta: parseInt(correctRadio.value) === idx
  }));

  const data = {
    topic: document.getElementById('p-topic').value,
    ce: parseInt(document.getElementById('p-ce').value) || null,
    criterio: document.getElementById('p-criterio').value.trim(),
    dificultad: document.getElementById('p-dificultad').value,
    enunciado: document.getElementById('p-enunciado').value,
    opciones: opciones
  };

  try {
    const btn = document.getElementById('btn-save-pregunta');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    if (id) {
      await updateDoc(doc(db, "preguntas", id), data);
      showToast('Pregunta actualizada', 'success');
    } else {
      data.creadaEn = serverTimestamp();
      await addDoc(collection(db, "preguntas"), data);
      showToast('Pregunta creada', 'success');
    }
    
    document.getElementById('modal-pregunta').classList.remove('modal-backdrop--visible');
    await loadPreguntas();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar', 'error');
  } finally {
    const btn = document.getElementById('btn-save-pregunta');
    btn.disabled = false;
    btn.innerText = 'Guardar Pregunta';
  }
}

window.editPregunta = (id) => {
  const p = allPreguntas.find(x => x.id === id);
  if (!p) return;
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-topic').value = p.topic || '';
  document.getElementById('p-ce').value = p.ce || '';
  document.getElementById('p-criterio').value = p.criterio || '';
  document.getElementById('p-dificultad').value = p.dificultad || 'media';
  document.getElementById('p-enunciado').value = p.enunciado;
  
  const opts = document.querySelectorAll('.p-opcion');
  const radios = document.querySelectorAll('.p-correcta');
  
  if(p.opciones) {
    p.opciones.forEach((opt, i) => {
      if(opts[i]) opts[i].value = opt.texto;
      if(radios[i]) radios[i].checked = opt.correcta;
    });
  }
  
  document.getElementById('modal-pregunta-title').innerText = 'Editar Pregunta';
  document.getElementById('modal-pregunta').classList.add('modal-backdrop--visible');
};

window.deletePregunta = async (id) => {
  showModal({
    title: 'Borrar Pregunta',
    body: '¿Borrar esta pregunta? No se puede deshacer.',
    dangerous: true,
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, "preguntas", id));
        showToast('Pregunta borrada', 'success');
        await loadPreguntas();
      } catch(e) {
        console.error(e);
        showToast('Error al borrar', 'error');
      }
    }
  });
};

async function deleteSelected() {
  if (selectedIds.size === 0) return;
  showModal({
    title: 'Borrar Preguntas',
    body: `¿Estás seguro de borrar las ${selectedIds.size} preguntas seleccionadas? No se puede deshacer.`,
    dangerous: true,
    onConfirm: async () => {
      const btn = document.getElementById('btn-delete-selected');
      btn.innerText = 'Borrando...';
      btn.disabled = true;
      
      try {
        const deletePromises = Array.from(selectedIds).map(id => deleteDoc(doc(db, "preguntas", id)));
        await Promise.all(deletePromises);
        showToast(`Se borraron ${selectedIds.size} preguntas`, 'success');
        selectedIds.clear();
        await loadPreguntas();
      } catch (err) {
        console.error(err);
        showToast('Error al borrar masivamente', 'error');
      } finally {
        btn.innerHTML = `🗑️ Borrar Seleccionados (<span id="delete-count">0</span>)`;
        updateSelectionUI();
      }
    }
  });
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("El archivo JSON debe contener un array de objetos");
    
    const btn = document.getElementById("btn-import-json");
    btn.innerText = 'Importando...';
    btn.disabled = true;

    let importadas = 0;
    for (const item of arr) {
      if (!item.enunciado || !item.opciones || !Array.isArray(item.opciones)) continue;

      const cleanData = {
        topic: item.topic || 'topic_kanban',
        ce: parseInt(item.ce || item.ra, 10) || null,
        criterio: item.criterio ? String(item.criterio).trim() : '',
        dificultad: item.dificultad || 'media',
        enunciado: item.enunciado,
        opciones: item.opciones.map(o => ({
          texto: o.texto || '',
          correcta: !!o.correcta
        })),
        creadaEn: serverTimestamp()
      };

      await addDoc(collection(db, "preguntas"), cleanData);
      importadas++;
    }
    showToast(`Se importaron ${importadas} preguntas`, "success");
    await loadPreguntas();
  } catch (err) {
    console.error(err);
    showToast("Error al importar: " + err.message, "error");
  } finally {
    const btn = document.getElementById("btn-import-json");
    btn.innerText = '📥 Importar JSON';
    btn.disabled = false;
    e.target.value = "";
  }
}

function showCoverage() {
  const container = document.getElementById('cobertura-body');
  container.innerHTML = '';
  
  let totalPreguntas = allPreguntas.length;

  if (totalPreguntas === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: var(--space-4); text-align: center; color: var(--text-muted);">No hay preguntas para calcular la cobertura.</div>';
    document.getElementById('modal-cobertura').classList.add('modal-backdrop--visible');
    return;
  }

  // 1. STATS POR BLOQUES
  const stats = {};
  Object.keys(TOPICS).forEach(key => {
    stats[key] = { total: 0, baja: 0, media: 0, alta: 0 };
  });
  
  allPreguntas.forEach(p => {
    const t = p.topic || 'Sin bloque';
    if (!stats[t]) stats[t] = { total: 0, baja: 0, media: 0, alta: 0 };
    stats[t].total++;
    const diff = p.dificultad || 'media';
    stats[t][diff] = (stats[t][diff] || 0) + 1;
  });
  
  const blocksTitle = document.createElement('h3');
  blocksTitle.innerHTML = '📊 Resumen por Bloques Temáticos';
  blocksTitle.style.marginBottom = 'var(--space-3)';
  blocksTitle.style.marginTop = '0';
  container.appendChild(blocksTitle);

  const gridStats = document.createElement('div');
  gridStats.style.display = 'grid';
  gridStats.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
  gridStats.style.gap = 'var(--space-4)';
  container.appendChild(gridStats);

  Object.keys(stats).forEach(key => {
    const s = stats[key];
    const name = TOPICS[key] ? TOPICS[key].name : key;
    const percent = totalPreguntas > 0 ? Math.round((s.total / totalPreguntas) * 100) : 0;
    
    const card = document.createElement('div');
    card.className = 'coverage-card';
    card.style.margin = '0';
    card.innerHTML = `
      <div class="coverage-header" style="font-size: 0.9rem;">
        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div><span class="badge badge--primary">${s.total} (${percent}%)</span></div>
      </div>
      <div class="coverage-body">
        <ul class="coverage-list" style="display: flex; gap: 10px; border: none; padding-bottom: 0;">
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Baja</div>
            <div class="badge badge--success">${s.baja || 0}</div>
          </li>
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Media</div>
            <div class="badge badge--warning">${s.media || 0}</div>
          </li>
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Alta</div>
            <div class="badge badge--danger">${s.alta || 0}</div>
          </li>
        </ul>
      </div>
    `;
    gridStats.appendChild(card);
  });

  // 2. STATS POR CRITERIOS
  const critTitle = document.createElement('h3');
  critTitle.innerHTML = '🎯 Cobertura de Criterios (BOJA)';
  critTitle.style.marginTop = 'var(--space-6)';
  critTitle.style.marginBottom = 'var(--space-3)';
  container.appendChild(critTitle);

  const allCriteriosMap = {};
  if (CURRICULUM && CURRICULUM.tico2 && CURRICULUM.tico2.ces) {
    Object.values(CURRICULUM.tico2.ces).forEach(ceObj => {
      Object.keys(ceObj.criterios).forEach(critKey => {
         allCriteriosMap[critKey] = ceObj.criterios[critKey];
      });
    });
  }

  const critCounts = {};
  Object.keys(allCriteriosMap).forEach(c => critCounts[c] = 0);
  
  allPreguntas.forEach(p => {
    if (p.criterio && p.criterio !== '-') {
      if (critCounts[p.criterio] === undefined) {
         critCounts[p.criterio] = 0;
         allCriteriosMap[p.criterio] = 'Criterio personalizado';
      }
      critCounts[p.criterio]++;
    }
  });

  const critCard = document.createElement('div');
  critCard.className = 'coverage-card';
  let critHtml = `<div class="coverage-body" style="max-height: 450px; overflow-y: auto; padding: 0;"><ul class="coverage-list">`;
  
  const grouped = {};
  Object.keys(allCriteriosMap).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(c => {
    const ce = c.split('.')[0];
    if (!grouped[ce]) grouped[ce] = [];
    grouped[ce].push(c);
  });

  Object.keys(grouped).sort((a,b) => Number(a) - Number(b)).forEach(ce => {
    critHtml += `<li style="background: var(--bg-surface); font-weight: bold; border-top: 1px solid var(--border); padding: 10px 15px; position: sticky; top: 0; z-index: 10;">Competencia Específica ${ce}</li>`;
    grouped[ce].forEach(c => {
      const count = critCounts[c] || 0;
      const text = allCriteriosMap[c];
      const badge = count > 0 
        ? `<span class="badge badge--success">${count} pregs</span>`
        : `<span class="badge badge--danger" style="opacity: 0.8;">Sin cubrir</span>`;
      
      const liStyle = count > 0 ? '' : 'opacity: 0.7;';
      
      critHtml += `
        <li style="display:flex; flex-direction:column; gap:5px; align-items:flex-start; padding: 12px 15px; border-bottom: 1px solid var(--border); ${liStyle}">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <strong style="font-size: 0.95rem; color: var(--text-primary);">Criterio ${c}</strong>
            ${badge}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${escapeHtml(text)}</div>
        </li>
      `;
    });
  });

  critHtml += `</ul></div>`;
  critCard.innerHTML = critHtml;
  container.appendChild(critCard);
  
  document.getElementById('modal-cobertura').classList.add('modal-backdrop--visible');
}

document.addEventListener('DOMContentLoaded', init);

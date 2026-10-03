import { db } from './common/db.js';
import { renderHeader, showToast } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { TOPICS, escapeHtml } from './common/utils.js';

let allPreguntas = [];
let currentPage = 1;
const pageSize = 50;
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
      if (data.topic === 'topic_audacity' || data.topic === 'topic_gimp') {
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
  document.getElementById('delete-count').innerText = selectedIds.size;
  document.getElementById('btn-delete-selected').disabled = selectedIds.size === 0;
  
  const chkRows = Array.from(document.querySelectorAll('.chk-row'));
  const allChecked = chkRows.length > 0 && chkRows.every(chk => chk.checked);
  document.getElementById('chk-all').checked = allChecked;
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
    let diffColor = 'success';
    if(p.dificultad === 'media') diffColor = 'warning';
    if(p.dificultad === 'alta') diffColor = 'danger';
    
    const correctaText = p.opciones?.find(o => o.correcta)?.texto || '?';
    const topicName = TOPICS[p.topic]?.name || p.topic || 'Sin bloque';

    return `
      <div class="question-row">
        <div><input class="chk-row" type="checkbox" value="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}></div>
        <div><span class="badge badge--primary" style="font-size:0.7em;">${escapeHtml(topicName)}</span></div>
        <div>CE ${p.ce || '-'}</div>
        <div style="color: var(--primary); font-weight: bold;">${p.criterio || '-'}</div>
        <div>
          <div class="question-text" title="${p.enunciado.replace(/"/g, '&quot;')}">${p.enunciado}</div>
          <div style="font-size: var(--text-xs); color: var(--success); margin-top: 4px;">✓ ${correctaText}</div>
        </div>
        <div><span class="badge badge--${diffColor}">${p.dificultad}</span></div>
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
  showModal('Borrar Pregunta', '¿Borrar esta pregunta? No se puede deshacer.', async () => {
    try {
      await deleteDoc(doc(db, "preguntas", id));
      showToast('Pregunta borrada', 'success');
      await loadPreguntas();
    } catch(e) {
      console.error(e);
      showToast('Error al borrar', 'error');
    }
  });
};

async function deleteSelected() {
  if (selectedIds.size === 0) return;
  showModal('Borrar Preguntas', `¿Estás seguro de borrar las ${selectedIds.size} preguntas seleccionadas? No se puede deshacer.`, async () => {
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
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("Debe ser un array de objetos");
    
    const btn = document.getElementById("btn-import-json");
    btn.innerText = 'Importando...';
    btn.disabled = true;

    let importadas = 0;
    for (let p of arr) {
      p.creadaEn = serverTimestamp();
      
      // Adapt from aprenderSQL module format to tic2 format if needed
      if(!p.topic) {
        p.topic = 'topic_kanban'; // Default fallback
      }
      
      if(p.ra && !p.ce) {
        p.ce = p.ra;
      }
      
      delete p.modulo;
      delete p.curso;
      delete p.ra;

      await addDoc(collection(db, "preguntas"), p);
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
  const stats = {};
  let totalGlobal = 0;

  allPreguntas.forEach(p => {
    const topic = p.topic || 'Sin bloque';
    if (!stats[topic]) stats[topic] = { total: 0, byDifficulty: { 1: 0, 2: 0, 3: 0, 'basica': 0, 'media': 0, 'alta': 0 } };
    
    stats[topic].total++;
    if (p.dificultad) {
       stats[topic].byDifficulty[p.dificultad] = (stats[topic].byDifficulty[p.dificultad] || 0) + 1;
    }
    totalGlobal++;
  });

  let html = `<div class="alert alert--info" style="margin-bottom: var(--space-4);">
    <strong>Total Batería Test:</strong> ${totalGlobal} preguntas registradas
  </div>`;
  
  Object.keys(stats).sort().forEach(topicKey => {
    const topicData = stats[topicKey];
    const topicObj = TOPICS[topicKey];
    const topicName = topicObj ? topicObj.name : topicKey;
    
    html += `
      <div class="coverage-card">
        <div class="coverage-header">
          <span>📚 ${escapeHtml(topicName)}</span>
          <span class="badge badge--primary">${topicData.total} preg.</span>
        </div>
        <div class="coverage-body">
          <ul class="coverage-list">
            <li>
              <span>Básica / Fácil</span>
              <span class="badge badge--success">${(topicData.byDifficulty[1] || 0) + (topicData.byDifficulty['basica'] || 0)}</span>
            </li>
            <li>
              <span>Media</span>
              <span class="badge badge--warning">${(topicData.byDifficulty[2] || 0) + (topicData.byDifficulty['media'] || 0)}</span>
            </li>
            <li>
              <span>Alta / Difícil</span>
              <span class="badge badge--danger">${(topicData.byDifficulty[3] || 0) + (topicData.byDifficulty['alta'] || 0)}</span>
            </li>
          </ul>
        </div>
      </div>
    `;
  });

  document.getElementById('cobertura-body').innerHTML = html;
  document.getElementById('modal-cobertura').classList.add('modal-backdrop--visible');
}

document.addEventListener('DOMContentLoaded', init);

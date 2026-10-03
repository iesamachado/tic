import { db } from './common/db.js';
import { requireAuth, currentUser } from './common/auth.js';
import { renderHeader, showToast, showLoading, hideLoading, showModal } from './common/ui.js';
import { $, $$, escapeHtml, getUrlParams } from './common/utils.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let user;
let examen = null;
let respuestaDoc = null;
let respuestaRef = null;

let currentQIndex = 0; // Index in the shuffled array
let timerInterval = null;

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (u, profile) => {
    user = u;
    currentProfile = profile;
    renderHeader(u, profile);
    
    const { id } = getUrlParams();
    if (!id) {
      showFinished("Error: No se ha especificado el examen.");
      return;
    }

    try {
      // Escuchar el estado del examen
      onSnapshot(doc(db, "examenes_test", id), async (snap) => {
        if (!snap.exists()) {
          showFinished("El examen no existe.");
          return;
        }
        examen = { id: snap.id, ...snap.data() };
        $('ex-title').textContent = examen.titulo;
        $('ex-student').textContent = profile.displayNameAnonymized || profile.displayName || user.email;

        // Load existing participation first
        if (!respuestaDoc) {
          respuestaRef = doc(db, "respuestas_test", `${id}_${user.uid}`);
          const rSnap = await getDoc(respuestaRef);
          if (rSnap.exists()) {
            respuestaDoc = rSnap.data();
          }
        }

        if (examen.estado !== 'activo') {
          if (!respuestaDoc) {
            showFinished("El examen ha finalizado y no llegaste a participar.");
          } else {
            stopExamAndShowResults();
          }
          return;
        }
        
        // Inicializar si es la primera vez que carga y está activo
        if (!respuestaDoc) {
          await initStudentState(id);
          startTimer();
          renderNav();
          showQuestion(0);
          
          $('loading-ui').style.display = 'none';
          $('exam-ui').style.display = 'flex';
        } else if (!respuestaDoc.entregadoEn && !timerInterval) {
          // Re-start if they reload while active
          startTimer();
          renderNav();
          showQuestion(0);
          
          $('loading-ui').style.display = 'none';
          $('exam-ui').style.display = 'flex';
        }
        
        // Si se publicaron resultados
        if (examen.resultadosPublicados && respuestaDoc?.entregadoEn) {
          showFinished();
        }
      }, (error) => {
        console.error("Error en snapshot:", error);
        showToast('Error', 'No se pudo cargar el estado del examen.', 'error');
      });
    } catch(e) {
      console.error(e);
      showToast('Error', 'No se pudo cargar el examen', 'error');
    }
  }
});

async function initStudentState(exId) {
  respuestaRef = doc(db, "respuestas_test", `${exId}_${user.uid}`);
  const snap = await getDoc(respuestaRef);
  
  if (snap.exists()) {
    respuestaDoc = snap.data();
    if (respuestaDoc.entregadoEn) {
      showFinished();
      throw new Error("Ya entregado");
    }
  } else {
    // Generar orden aleatorio
    const indices = Array.from({length: examen.preguntas.length}, (_, i) => i);
    indices.sort(() => Math.random() - 0.5);
    
    const ordenOpciones = {};
    examen.preguntas.forEach(p => {
      const optIndices = Array.from({length: p.opciones.length}, (_, i) => i);
      optIndices.sort(() => Math.random() - 0.5);
      ordenOpciones[p.id] = optIndices;
    });

    respuestaDoc = {
      examenId: exId,
      uid: user.uid,
      claseId: examen.claseId,
      ordenPreguntas: indices,
      ordenOpciones: ordenOpciones,
      respuestas: {},
      empezadoEn: serverTimestamp()
    };
    await setDoc(respuestaRef, respuestaDoc);
  }
}

function startTimer() {
  const inicioMs = examen.activadoEn ? examen.activadoEn.toMillis() : (examen.creadoEn ? examen.creadoEn.toMillis() : Date.now());
  const finMs = inicioMs + (examen.tiempoMinutos * 60 * 1000);

  timerInterval = setInterval(() => {
    const ahora = Date.now();
    const rest = finMs - ahora;
    
    if (rest <= 0) {
      clearInterval(timerInterval);
      $('timer').textContent = "00:00";
      entregarExamen();
      return;
    }

    const m = Math.floor(rest / 60000);
    const s = Math.floor((rest % 60000) / 1000);
    const el = $('timer');
    el.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    
    if (rest < 300000) {
      el.classList.add('danger');
    }
  }, 1000);
}

function renderNav() {
  const nav = $('q-nav');
  let html = '';
  respuestaDoc.ordenPreguntas.forEach((origIdx, renderIdx) => {
    const qId = examen.preguntas[origIdx].id;
    const isAns = respuestaDoc.respuestas[qId] !== undefined;
    html += `<div class="q-btn ${isAns ? 'answered' : ''}" id="nav-btn-${renderIdx}" onclick="window.showQuestion(${renderIdx})">${renderIdx + 1}</div>`;
  });
  nav.innerHTML = html;
  updateCounts();
}

function updateCounts() {
  const total = examen.preguntas.length;
  const ans = Object.keys(respuestaDoc.respuestas).length;
  $('count-ans').textContent = ans;
  $('count-pend').textContent = total - ans;
  $('q-total-num').textContent = total;
}

window.showQuestion = (renderIdx) => {
  if (renderIdx < 0 || renderIdx >= examen.preguntas.length) return;
  
  $$('.q-btn').forEach(b => b.classList.remove('active'));
  $(`nav-btn-${renderIdx}`).classList.add('active');
  
  currentQIndex = renderIdx;
  $('q-current-num').textContent = renderIdx + 1;
  
  const origIdx = respuestaDoc.ordenPreguntas[renderIdx];
  const q = examen.preguntas[origIdx];
  
  $('q-tema-badge').textContent = `CE ${q.ce}`;
  $('q-text').textContent = q.enunciado;
  
  const optsHtml = respuestaDoc.ordenOpciones[q.id].map(optOrigIdx => {
    const texto = q.opciones[optOrigIdx].texto;
    const isChecked = respuestaDoc.respuestas[q.id] === optOrigIdx;
    
    return `
      <label class="option-label ${isChecked ? 'selected' : ''}" onclick="window.selectOption('${q.id}', ${optOrigIdx})">
        <input type="radio" name="opt-${q.id}" style="display:none;" ${isChecked ? 'checked' : ''}>
        <div style="display: flex; align-items: center;">
          <div class="option-circle ${isChecked ? 'checked' : ''}">
            ${isChecked ? '✓' : ''}
          </div>
          <div style="flex: 1;">${escapeHtml(texto)}</div>
        </div>
      </label>
    `;
  }).join('');
  $('q-options').innerHTML = optsHtml;
  
  $('btn-prev').disabled = renderIdx === 0;
  $('btn-next').disabled = renderIdx === examen.preguntas.length - 1;
};

window.selectOption = (qId, optOrigIdx) => {
  if (!respuestaDoc) return;
  
  const currentVal = respuestaDoc.respuestas[qId];
  if (currentVal === optOrigIdx) {
    delete respuestaDoc.respuestas[qId];
  } else {
    respuestaDoc.respuestas[qId] = optOrigIdx;
  }
  
  // Update UI Local INSTANTLY
  const renderIdx = respuestaDoc.ordenPreguntas.findIndex(idx => examen.preguntas[idx].id === qId);
  if (renderIdx !== -1) {
    const btn = $(`nav-btn-${renderIdx}`);
    if (respuestaDoc.respuestas[qId] !== undefined) {
      btn.classList.add('answered');
    } else {
      btn.classList.remove('answered');
    }
  }
  updateCounts();
  showQuestion(currentQIndex);

  // Background update (no await) to avoid UI freezing
  updateDoc(respuestaRef, { respuestas: respuestaDoc.respuestas }).catch(e => {
    console.error(e);
  });
};

$('btn-prev')?.addEventListener('click', () => { showQuestion(currentQIndex - 1); });
$('btn-next')?.addEventListener('click', () => { showQuestion(currentQIndex + 1); });
$('btn-entregar')?.addEventListener('click', entregarExamenUI);

function entregarExamenUI() {
  const ans = Object.keys(respuestaDoc.respuestas).length;
  const pend = examen.preguntas.length - ans;
  const msg = pend > 0 ? `Te faltan ${pend} preguntas por responder. ¿Estás seguro de entregar?` : `¿Confirmar entrega del examen?`;
  
  showModal('Entregar Examen', msg, () => {
    entregarExamen();
  });
}

async function entregarExamen() {
  if (timerInterval) clearInterval(timerInterval);
  showLoading('Entregando...');
  try {
    await updateDoc(respuestaRef, { entregadoEn: serverTimestamp() });
    respuestaDoc.entregadoEn = new Date();
    stopExamAndShowResults();
  } catch(e) {
    console.error(e);
    showToast('Error', 'No se pudo entregar el examen', 'error');
  } finally {
    hideLoading();
  }
}

function stopExamAndShowResults() {
  if (timerInterval) clearInterval(timerInterval);
  $('exam-ui').style.setProperty('display', 'none', 'important');
  $('loading-ui').style.display = 'none';
  $('exam-header').style.display = 'none';
  
  const finUi = $('finished-ui');
  finUi.style.display = 'block';

  if (examen.resultadosPublicados && respuestaDoc.entregadoEn) {
    mostrarResultadosPublicados();
  } else {
    // Solo mostramos el mensaje de fin, no hay revisión
  }
}

function showFinished(msg = "") {
  if (timerInterval) clearInterval(timerInterval);
  $('exam-ui').style.setProperty('display', 'none', 'important');
  $('loading-ui').style.display = 'none';
  $('exam-header').style.display = 'none';
  
  const finUi = $('finished-ui');
  finUi.style.display = 'block';
  if (msg) {
    finUi.querySelector('p').textContent = msg;
  }
  
  if (examen && examen.resultadosPublicados && respuestaDoc && respuestaDoc.entregadoEn) {
    mostrarResultadosPublicados();
  }
}

function mostrarResultadosPublicados() {
  if (respuestaDoc.nota !== undefined) {
    $('final-grade').textContent = respuestaDoc.nota.toFixed(2);
    $('grade-container').style.display = 'block';
  }
  
  if (examen.correcciones) {
    const reviewC = $('review-container');
    const reviewL = $('review-list');
    let html = '';
    let c = 0, e = 0, b = 0;
    
    respuestaDoc.ordenPreguntas.forEach((origIdx, renderIdx) => {
      const q = examen.preguntas[origIdx];
      const studAns = respuestaDoc.respuestas[q.id];
      const correctAns = examen.correcciones[q.id];
      
      const isCorrect = studAns === correctAns;
      const noAnswer = studAns === undefined;
      
      if (isCorrect) c++;
      else if (noAnswer) b++;
      else e++;
      
      let border = isCorrect ? 'var(--success)' : (noAnswer ? 'var(--warning)' : 'var(--error)');
      let status = isCorrect ? '✅' : (noAnswer ? '➖' : '❌');
      
      html += `
        <div style="border: 2px solid ${border}; border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4); background: var(--bg-surface);">
          <div style="font-weight: bold; margin-bottom: var(--space-3); font-size: 1.1rem;">
            ${renderIdx + 1}. ${escapeHtml(q.enunciado)} ${noAnswer ? '<span class="badge badge--warning">En blanco</span>' : ''}
          </div>
          <div>
      `;
      
      respuestaDoc.ordenOpciones[q.id].forEach((optOrigIdx) => {
         const texto = q.opciones[optOrigIdx].texto;
         
         let badge = '';
         let textStyle = 'color: var(--text-muted);';
         if (optOrigIdx === correctAns) {
           badge = '<span class="badge badge--success" style="margin-left: 8px;">Correcta</span>';
           textStyle = 'color: var(--success); font-weight: bold;';
         } else if (optOrigIdx === studAns) {
           badge = '<span class="badge badge--danger" style="margin-left: 8px;">Tu respuesta</span>';
           textStyle = 'color: var(--error); font-weight: bold;';
         }
         
         html += `<div style="margin-bottom: 6px; padding: var(--space-2); background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); ${textStyle}">• ${escapeHtml(texto)} ${badge}</div>`;
      });
      html += `</div></div>`;
    });
    
    reviewL.innerHTML = html;
    reviewC.style.display = 'block';
    
    $('stat-correct').textContent = c;
    $('stat-incorrect').textContent = e;
    $('stat-blank').textContent = b;
    $('grade-container').querySelector('.d-flex').style.display = 'flex';
  }
}

let warnings = 0;
let currentProfile = null;

function handleFocusLost() {
  if (!respuestaDoc || respuestaDoc.entregadoEn) return;
  if (currentProfile && (currentProfile.role === 'teacher' || currentProfile.role === 'admin')) return;

  warnings++;
  if (warnings === 1) {
    showModal('⚠️ ¡Atención!', 'Has salido de la ventana del examen. Recuerda que no está permitido consultar otras pestañas o aplicaciones. Si vuelves a salir, el examen se entregará automáticamente con todas las respuestas anuladas.', () => {}, { hideCancel: true });
  } else if (warnings === 2) {
    showModal('❌ Examen Anulado', 'Has vuelto a salir de la ventana. Por motivos de seguridad, el examen se ha cancelado y entregado automáticamente.', () => {
      window.location.href = 'dashboard_student.html';
    }, { hideCancel: true });
    
    anularExamen();
  }
}

async function anularExamen() {
  if (timerInterval) clearInterval(timerInterval);
  showLoading('Anulando...');
  try {
    await updateDoc(respuestaRef, { respuestas: {}, entregadoEn: serverTimestamp(), anuladoPorTrampas: true });
    respuestaDoc.entregadoEn = new Date();
  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

window.addEventListener('blur', handleFocusLost);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') handleFocusLost();
});


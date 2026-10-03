import { db } from './common/db.js';
import { renderHeader, showToast } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import { getUrlParams, $, $$, escapeHtml, TOPICS } from './common/utils.js';
import { addPointsAndCheckLogros, awardMedal } from './common/gamification.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let examen = null;
let bancoPreguntasCompleto = [];
let globalEntregas = [];
let globalAlumnos = {};
let globalQStats = {};

function init() {
  requireAuth({
    allowedRoles: ['teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      renderHeader(user, profile);
  
  const { id } = getUrlParams();
  if (!id) {
    showToast('Error', 'No se ha especificado el ID del examen', 'error');
    setTimeout(() => window.location.href = 'dashboard_teacher.html', 2000);
    return;
  }

  try {
    const snap = await getDoc(doc(db, "examenes_test", id));
    if(!snap.exists()) {
      showToast('Error', 'El examen no existe', 'error');
      return;
    }
    
    examen = { id: snap.id, ...snap.data() };
    
    $('back-link').href = `class_detail.html?classId=${examen.claseId}`;
    $('ex-title').textContent = examen.titulo;
    updateHeaderUI();
    $('btn-toggle-state').addEventListener('click', toggleExamenState);

    const btnToggle = $('btn-toggle-results');
    if (examen.resultadosPublicados) {
      btnToggle.textContent = 'Ocultar Notas a Alumnos';
      btnToggle.classList.replace('btn-primary', 'btn-danger');
    }

    btnToggle.addEventListener('click', toggleResultados);
    $('btn-print').addEventListener('click', printExams);

    // Cargar banco completo para tener correctas y enunciados
    const qsSnap = await getDocs(query(collection(db, "preguntas")));
    bancoPreguntasCompleto = qsSnap.docs.map(d => ({id: d.id, ...d.data()}));

    setupTabs();
    setupModals();
    await loadEntregas();

  } catch (e) {
    console.error(e);
    showToast('Error', 'No se pudo cargar el examen', 'error');
  }
    }
  });
}


function setupTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      $$('.tab-content').forEach(s => s.style.display = 'none');
      $(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });
}

function setupModals() {
  $('btn-close-review').addEventListener('click', () => $('modal-review').classList.remove('modal-backdrop--visible'));
  $('btn-close-qdetail').addEventListener('click', () => $('modal-qdetail').classList.remove('modal-backdrop--visible'));
}

async function loadEntregas() {
  const q = query(collection(db, "respuestas_test"), where("examenId", "==", examen.id));
  const snap = await getDocs(q);
  
  const tbody = $('resultados-list');
  if (snap.empty) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:var(--space-6);">Nadie ha entregado todavía.</td></tr>';
    $('analysis-container').innerHTML = '<div style="text-align:center; padding:var(--space-6); color:var(--text-muted);">No hay datos suficientes para el análisis.</div>';
    return;
  }

  // Obtener alumnos
  const uIds = [];
  snap.forEach(d => { if(!uIds.includes(d.data().uid)) uIds.push(d.data().uid); });
  
  if (uIds.length > 0) {
    // Si hay más de 30 ids, hay que hacer chunking, pero asumimos clases < 30
    const chunks = [];
    for (let i = 0; i < uIds.length; i += 30) chunks.push(uIds.slice(i, i + 30));
    
    globalAlumnos = {};
    for (const chunk of chunks) {
      const uSnap = await getDocs(query(collection(db, "tic2_users"), where("__name__", "in", chunk)));
      uSnap.forEach(d => globalAlumnos[d.id] = d.data());
    }
  }

  let html = '';
  globalEntregas = [];
  
  const qStats = {};
  examen.preguntas.forEach(p => {
     const fullQ = bancoPreguntasCompleto.find(x => x.id === p.id) || p;
     qStats[p.id] = { 
       id: p.id, 
       enunciado: fullQ.enunciado, 
       opciones: fullQ.opciones || [], 
       correcta: fullQ.correcta, 
       criterio: fullQ.criterio || 'N/A', 
       acertada: 0, fallada: 0, blanco: 0 
     };
  });
  globalQStats = qStats;

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const al = globalAlumnos[d.uid] || { displayName: 'Desconocido', email: '' };
    globalEntregas.push({ id: docSnap.id, ...d });
    
    let aciertos = 0;
    let errores = 0;
    let blancas = 0;
    
    const topicStats = {};
    const critStats = {};
    
    examen.preguntas.forEach(p => {
      const ansIdx = d.respuestas ? d.respuestas[p.id] : undefined;
      const origQ = bancoPreguntasCompleto.find(x => x.id === p.id);
      const topic = String(origQ?.topic || p.topic || 'Sin Bloque');
      const crit = String(origQ?.criterio || p.criterio || 'N/A');
      
      if (!topicStats[topic]) topicStats[topic] = { a: 0, e: 0, b: 0, total: 0 };
      if (!critStats[crit]) critStats[crit] = { a: 0, e: 0, b: 0, total: 0 };
      
      topicStats[topic].total++;
      critStats[crit].total++;
      
      if (ansIdx === undefined) {
         blancas++;
         topicStats[topic].b++;
         critStats[crit].b++;
         if (qStats[p.id]) qStats[p.id].blanco++;
      } else if (origQ && origQ.opciones[ansIdx] && origQ.opciones[ansIdx].correcta) {
         aciertos++;
         topicStats[topic].a++;
         critStats[crit].a++;
         if (qStats[p.id]) qStats[p.id].acertada++;
      } else {
         errores++;
         topicStats[topic].e++;
         critStats[crit].e++;
         if (qStats[p.id]) qStats[p.id].fallada++;
      }
    });
    
    const penalizacion = errores / 3.0;
    const aciertosNetos = Math.max(0, aciertos - penalizacion);
    const nota = (aciertosNetos / examen.preguntas.length) * 10;
    const color = nota >= 5 ? 'var(--success)' : 'var(--error)';
    const dateStr = d.entregadoEn ? d.entregadoEn.toDate().toLocaleString('es-ES') : '-';

    const notasTopics = {};
    for (const topic in topicStats) {
      const ts = topicStats[topic];
      const pen = ts.e / 3.0;
      const netos = Math.max(0, ts.a - pen);
      notasTopics[topic] = ts.total > 0 ? parseFloat(((netos / ts.total) * 10).toFixed(4)) : null;
    }

    const notasCriterios = {};
    for (const crit in critStats) {
      const cs = critStats[crit];
      const pen = cs.e / 3.0;
      const netos = Math.max(0, cs.a - pen);
      notasCriterios[crit] = cs.total > 0 ? parseFloat(((netos / cs.total) * 10).toFixed(4)) : null;
    }

    const needsUpdate = d.nota !== nota || JSON.stringify(d.notasTopics) !== JSON.stringify(notasTopics) || JSON.stringify(d.notasCriterios) !== JSON.stringify(notasCriterios);
    if (needsUpdate) {
      updateDoc(doc(db, "respuestas_test", docSnap.id), { nota, notasTopics, notasCriterios, examenId: examen.id, claseId: examen.claseId });
    }

    html += `
      <tr>
        <td style="text-align: left;">
          <div style="font-weight: bold;">${escapeHtml(al.displayName || al.name || 'Alumno')}</div>
          <div style="font-size: 0.85em; color: var(--text-muted);">${escapeHtml(al.email || '')}</div>
        </td>
        <td>${dateStr}</td>
        <td>
          <span style="color:var(--success); font-weight:bold;">${aciertos}</span> / 
          <span style="color:var(--error); font-weight:bold;">${errores}</span> / 
          <span style="color:var(--warning); font-weight:bold;">${blancas}</span>
        </td>
        <td style="font-weight: bold; font-size: 1.2em; color: ${color};">${nota.toFixed(2)}</td>
        <td style="text-align: right;">
          <button class="btn btn-ghost btn--sm" onclick="window.reviewStudent('${docSnap.id}')">👁️ Revisar</button>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
  renderAnalysis(qStats);
}

function renderAnalysis(qStats) {
  const list = Object.values(qStats);
  if (list.length === 0) return;
  
  list.sort((a, b) => b.acertada - a.acertada);
  const maxAciertos = list[0];
  
  list.sort((a, b) => b.fallada - a.fallada);
  const maxFalladas = list[0];
  
  list.sort((a, b) => b.blanco - a.blanco);
  const maxBlancos = list[0];
  
  const topicStats = {};
  examen.preguntas.forEach(p => {
    const fullQ = bancoPreguntasCompleto.find(x => x.id === p.id) || p;
    const topic = fullQ.topic || p.topic || 'Sin bloque';
    if (!topicStats[topic]) topicStats[topic] = { numQ: 0, sumNota: 0, countNota: 0 };
    topicStats[topic].numQ++;
  });

  globalEntregas.forEach(d => {
    if (d.notasTopics) {
      for (const topic in d.notasTopics) {
        if (d.notasTopics[topic] !== null && topicStats[topic]) {
          topicStats[topic].sumNota += d.notasTopics[topic];
          topicStats[topic].countNota++;
        }
      }
    }
  });

  const criteriaStats = {};
  examen.preguntas.forEach(p => {
    const fullQ = bancoPreguntasCompleto.find(x => x.id === p.id) || p;
    const crit = fullQ.criterio || p.criterio || 'N/A';
    if (!criteriaStats[crit]) criteriaStats[crit] = { numQ: 0, sumNota: 0, countNota: 0 };
    criteriaStats[crit].numQ++;
  });

  globalEntregas.forEach(d => {
    if (d.notasCriterios) {
      for (const crit in d.notasCriterios) {
        if (d.notasCriterios[crit] !== null && criteriaStats[crit]) {
          criteriaStats[crit].sumNota += d.notasCriterios[crit];
          criteriaStats[crit].countNota++;
        }
      }
    }
  });

  let critHtml = `
    <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--border); padding-bottom: var(--space-2);">Rendimiento Medio por Bloque de Teoría</h3>
    <div class="stats-grid" style="margin-bottom: var(--space-6);">`;

  for (const topic of Object.keys(topicStats).sort()) {
    const stat = topicStats[topic];
    const avg = stat.countNota > 0 ? (stat.sumNota / stat.countNota).toFixed(2) : '-';
    let cardClass = '';
    if (avg !== '-') {
      cardClass = avg >= 5 ? 'stat-card--success' : 'stat-card--error';
    }
    const topicName = TOPICS[topic] ? TOPICS[topic].name : topic;
    critHtml += `
      <div class="stat-card ${cardClass}">
        <div style="font-weight:bold; color:var(--primary); margin-bottom:4px;">${escapeHtml(topicName)}</div>
        <div class="stat-label">${stat.numQ} preguntas en total</div>
        <div class="stat-value" style="margin-top:8px;">${avg} <span style="font-size:0.4em; font-weight:normal; color:var(--text-muted);">/ 10</span></div>
      </div>`;
  }
  critHtml += `</div>`;

  critHtml += `
    <h3 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--border); padding-bottom: var(--space-2);">Rendimiento Medio por Criterio de Evaluación</h3>
    <div class="stats-grid">`;

  for (const crit of Object.keys(criteriaStats).sort()) {
    const stat = criteriaStats[crit];
    const avg = stat.countNota > 0 ? (stat.sumNota / stat.countNota).toFixed(2) : '-';
    let cardClass = '';
    if (avg !== '-') {
      cardClass = avg >= 5 ? 'stat-card--success' : 'stat-card--error';
    }
    critHtml += `
      <div class="stat-card ${cardClass}">
        <div style="font-weight:bold; color:var(--primary); margin-bottom:4px;">Criterio ${crit}</div>
        <div class="stat-label">${stat.numQ} preguntas en total</div>
        <div class="stat-value" style="margin-top:8px;">${avg} <span style="font-size:0.4em; font-weight:normal; color:var(--text-muted);">/ 10</span></div>
      </div>`;
  }
  critHtml += `</div>`;
  
  const container = $('analysis-container');
  container.innerHTML = `
    ${critHtml}
    
    <h3 style="margin-top: var(--space-6); margin-bottom: var(--space-4); border-bottom: 2px solid var(--border); padding-bottom: var(--space-2);">Análisis de Preguntas</h3>
    <div class="stats-grid">
      <div class="stat-card stat-card--success" style="text-align: left;">
        <div style="font-weight:bold; margin-bottom:8px;">✅ Más Acertada</div>
        <div style="font-size:0.9em; margin-bottom:8px; height: 60px; overflow: hidden;">${maxAciertos.enunciado}</div>
        <span class="badge badge--success">${maxAciertos.acertada} aciertos</span>
      </div>
      <div class="stat-card stat-card--error" style="text-align: left;">
        <div style="font-weight:bold; margin-bottom:8px;">❌ Más Fallada</div>
        <div style="font-size:0.9em; margin-bottom:8px; height: 60px; overflow: hidden;">${maxFalladas.enunciado}</div>
        <span class="badge badge--danger">${maxFalladas.fallada} fallos</span>
      </div>
      <div class="stat-card stat-card--warning" style="text-align: left;">
        <div style="font-weight:bold; margin-bottom:8px;">➖ Más en Blanco</div>
        <div style="font-size:0.9em; margin-bottom:8px; height: 60px; overflow: hidden;">${maxBlancos.enunciado}</div>
        <span class="badge badge--warning">${maxBlancos.blanco} blancos</span>
      </div>
    </div>

    <div style="margin-top: var(--space-6);">
      <h3 style="margin-bottom: var(--space-4);">Detalle por Pregunta</h3>
      <table class="ranking-table" style="font-size: 0.9em;">
        <thead>
          <tr>
            <th>#</th>
            <th style="text-align: left;">Pregunta</th>
            <th>Criterio</th>
            <th style="color: var(--success);">Aciertos</th>
            <th style="color: var(--error);">Fallos</th>
            <th style="color: var(--warning);">Blancos</th>
          </tr>
        </thead>
        <tbody>
          ${examen.preguntas.map((p, i) => {
             const st = qStats[p.id];
             if (!st) return '';
             return `
               <tr style="cursor: pointer;" onclick="window.showQuestionDetails('${p.id}')">
                 <td>${i + 1}</td>
                 <td style="text-align: left; max-width:300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(st.enunciado)}">${escapeHtml(st.enunciado)}</td>
                 <td><span class="badge badge--muted">${st.criterio}</span></td>
                 <td style="color: var(--success); font-weight: bold;">${st.acertada}</td>
                 <td style="color: var(--error); font-weight: bold;">${st.fallada}</td>
                 <td style="color: var(--warning); font-weight: bold;">${st.blanco}</td>
               </tr>
             `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.reviewStudent = (respuestaId) => {
  const entrega = globalEntregas.find(e => e.id === respuestaId);
  if (!entrega) return;
  const al = globalAlumnos[entrega.uid];
  $('review-student-name').textContent = al ? (al.displayName || al.name || 'Alumno') : 'Alumno';
  
  let reviewHtml = '';
  examen.preguntas.forEach((q, idx) => {
    const studentAnsIdx = entrega.respuestas ? entrega.respuestas[q.id] : undefined;
    const origQ = bancoPreguntasCompleto.find(x => x.id === q.id) || q;
    const correctOrigIdx = origQ.opciones.findIndex(o => o.correcta);
    
    const isCorrect = studentAnsIdx === correctOrigIdx;
    const noAnswer = studentAnsIdx === undefined;
    
    let borderColor = isCorrect ? 'var(--success)' : (noAnswer ? 'var(--warning)' : 'var(--error)');
    let blankBadge = noAnswer ? '<span class="badge badge--warning" style="margin-left:8px;">En blanco</span>' : '';
    
    reviewHtml += `
      <div style="border: 2px solid ${borderColor}; border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-4); background: var(--bg-card);">
        <div style="font-weight: bold; margin-bottom: var(--space-3);">
          ${idx + 1}. ${escapeHtml(q.enunciado)} ${blankBadge}
        </div>
        <div>`;
      
    origQ.opciones.forEach((opt, optIdx) => {
        let badge = '';
        let textStyle = 'color: var(--text-muted);';
        if (optIdx === correctOrigIdx) {
          badge = '<span class="badge badge--success" style="margin-left:8px;">Correcta</span>';
          textStyle = 'color: var(--success); font-weight: bold;';
        } else if (optIdx === studentAnsIdx) {
          badge = '<span class="badge badge--danger" style="margin-left:8px;">Marcada</span>';
          textStyle = 'color: var(--error); font-weight: bold;';
        }
        reviewHtml += `<div style="margin-bottom: 4px; ${textStyle}">• ${escapeHtml(opt.texto)} ${badge}</div>`;
    });
    
    reviewHtml += `</div></div>`;
  });
  
  $('review-student-body').innerHTML = reviewHtml;
  $('modal-review').classList.add('modal-backdrop--visible');
};

window.showQuestionDetails = function(qId) {
  const st = globalQStats[qId];
  if (!st) return;
  
  let html = `
    <div style="margin-bottom: var(--space-4);">
      <h4 style="color: var(--primary); margin-bottom: 8px;">Enunciado:</h4>
      <div style="background: var(--bg-surface); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border);">${escapeHtml(st.enunciado)}</div>
    </div>
    
    <h4 style="color: var(--primary); margin-bottom: 8px;">Opciones de respuesta:</h4>
    <div style="margin-bottom: var(--space-4);">`;
    
  if (st.opciones && st.opciones.length > 0) {
    st.opciones.forEach((opt) => {
      const isCorrect = opt.correcta;
      const border = isCorrect ? '2px solid var(--success)' : '1px solid var(--border)';
      const bg = isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-surface)';
      
      html += `
        <div style="border: ${border}; background: ${bg}; padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>${escapeHtml(opt.texto)}</div>
          ${isCorrect ? '<span class="badge badge--success">Correcta</span>' : ''}
        </div>
      `;
    });
  }
  html += `</div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); text-align: center;">
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); padding: var(--space-3); border-radius: var(--radius-md);">
        <div style="font-size: 1.5rem; font-weight: bold; color: var(--success);">${st.acertada}</div>
        <div style="font-size: var(--text-sm); color: var(--text-muted);">Aciertos</div>
      </div>
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); padding: var(--space-3); border-radius: var(--radius-md);">
        <div style="font-size: 1.5rem; font-weight: bold; color: var(--error);">${st.fallada}</div>
        <div style="font-size: var(--text-sm); color: var(--text-muted);">Fallos</div>
      </div>
      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); padding: var(--space-3); border-radius: var(--radius-md);">
        <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning);">${st.blanco}</div>
        <div style="font-size: var(--text-sm); color: var(--text-muted);">En Blanco</div>
      </div>
    </div>
  `;
  
  $('qdetail-body').innerHTML = html;
  $('modal-qdetail').classList.add('modal-backdrop--visible');
};


function updateHeaderUI() {
  $('ex-meta').textContent = `${examen.preguntas.length} preguntas | ${examen.tiempoMinutos} min | Estado: ${examen.estado.toUpperCase()}`;
  
  const btnState = $('btn-toggle-state');
  btnState.style.display = 'inline-block';
  
  if (examen.estado === 'oculto') {
    btnState.innerHTML = '👁️ Activar (Visible a alumnos)';
    btnState.className = 'btn btn-outline';
    btnState.style.borderColor = 'var(--primary)';
    btnState.style.color = 'var(--primary)';
  } else if (examen.estado === 'activo') {
    btnState.innerHTML = '🔒 Cerrar Examen';
    btnState.className = 'btn btn-outline';
    btnState.style.borderColor = 'var(--error)';
    btnState.style.color = 'var(--error)';
  } else {
    btnState.innerHTML = '👁️ Reabrir Examen';
    btnState.className = 'btn btn-outline';
    btnState.style.borderColor = 'var(--warning)';
    btnState.style.color = 'var(--warning)';
  }
}

async function toggleExamenState() {
  let newState = '';
  let msg = '';
  let confirmMsg = '';
  let confirmTitle = '';
  
  if (examen.estado === 'oculto' || examen.estado === 'cerrado') {
    confirmTitle = 'Activar Examen';
    confirmMsg = '¿Activar este examen? Los alumnos empezarán a verlo y el tiempo empezará a contar.';
    newState = 'activo';
    msg = 'Examen activado (Visible)';
  } else if (examen.estado === 'activo') {
    confirmTitle = 'Cerrar Examen';
    confirmMsg = '¿Cerrar el examen? Los alumnos no podrán entregar más respuestas.';
    newState = 'cerrado';
    msg = 'Examen cerrado';
  }
  
  showModal(confirmTitle, confirmMsg, async () => {
    await updateDoc(doc(db, "examenes_test", examen.id), { estado: newState });
    examen.estado = newState;
    showToast('Estado actualizado', msg, 'success');
    updateHeaderUI();
  });
}

async function toggleResultados() {
  const nuevoVal = !examen.resultadosPublicados;
  const updateData = { resultadosPublicados: nuevoVal };
  
  if (nuevoVal) {
    const correcciones = {};
    examen.preguntas.forEach(p => {
       const bq = bancoPreguntasCompleto.find(x => x.id === p.id);
       if (bq) {
         const correctIdx = bq.opciones.findIndex(o => o.correcta);
         if(correctIdx !== -1) correcciones[p.id] = correctIdx;
       }
    });
    updateData.correcciones = correcciones;
    
    // Otorgar puntos básicos en TIC2Hub (no tenemos sistema de medallas idéntico, sumaremos puntos XP)
    let repartidos = 0;
    for (const entrega of globalEntregas) {
      if (entrega.puntosOtorgados) continue;
      
      let xp = 100; // Por hacer el examen
      if (entrega.nota >= 5) xp += 100;
      if (entrega.nota >= 9) xp += 200;

      const uSnap = await getDoc(doc(db, 'tic2_users', entrega.uid));
      if (uSnap.exists()) {
        await addPointsAndCheckLogros(entrega.uid, xp, null, 'tic2_users');
        await awardMedal(entrega.uid, 'first_blood', 'tic2_users');
        if (entrega.nota >= 10) await awardMedal(entrega.uid, 'maestro_teoria', 'tic2_users');

        await updateDoc(doc(db, "respuestas_test", entrega.id), { puntosOtorgados: true });
        repartidos++;
      }
    }
    updateData.puntosRepartidos = true;
    examen.puntosRepartidos = true;
    if (repartidos > 0) showToast('Recompensas', `Se sumó XP a ${repartidos} alumnos.`, 'info');
  }
  
  await updateDoc(doc(db, "examenes_test", examen.id), updateData);
  examen.resultadosPublicados = nuevoVal;
  showToast(nuevoVal ? 'Notas publicadas' : 'Notas ocultadas', '', 'success');
  
  const btn = $('btn-toggle-results');
  if (nuevoVal) {
    btn.classList.replace('btn-primary', 'btn-danger');
    btn.textContent = 'Ocultar Notas a Alumnos';
  } else {
    btn.classList.replace('btn-danger', 'btn-primary');
    btn.textContent = 'Publicar Notas a Alumnos';
  }
}

function printExams() {
  const printArea = $('print-area');
  
  const qsExamen = examen.preguntas.map(pInfo => bancoPreguntasCompleto.find(bq => bq.id === pInfo.id)).filter(Boolean);
  const htmlA = renderExamenPapel(qsExamen, 'A', 'Versión A');
  
  const qsB = JSON.parse(JSON.stringify(qsExamen)).sort(() => Math.random() - 0.5);
  qsB.forEach(q => q.opciones.sort(() => Math.random() - 0.5));
  
  const htmlB = renderExamenPapel(qsB, 'B', 'Versión B');

  printArea.innerHTML = htmlA + '<div class="page-break"></div>' + htmlB;
  window.print();
  printArea.innerHTML = '';
}

function renderExamenPapel(preguntas, version, tituloExtra) {
  let h = `
    <div style="font-family: sans-serif; padding: 20px;">
      <div class="print-header">
        <h2>${escapeHtml(examen.titulo)} — ${tituloExtra}</h2>
        <div style="margin-top: 15px; font-size: 1.1em; display: flex; justify-content: space-between;">
          <span><strong>Nombre y Apellidos:</strong> _______________________________________________________</span>
          <span><strong>Nota:</strong> _____ / 10</span>
        </div>
      </div>
      <div style="margin-top:20px;">
  `;

  preguntas.forEach((q, idx) => {
    h += `<div class="print-q">
      <strong>${idx+1}. ${escapeHtml(q.enunciado)}</strong>
      <div style="margin-top: 10px;">
    `;
    q.opciones.forEach((opt) => {
      h += `<div class="print-opt">◯ ${escapeHtml(opt.texto)}</div>`;
    });
    h += `</div></div>`;
  });

  h += `</div></div>`;
  return h;
}

document.addEventListener('DOMContentLoaded', init);

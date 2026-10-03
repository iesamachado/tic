// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — dashboard_student.js
// ═══════════════════════════════════════════════════════════════════════
import { requireAuth, currentUser, currentProfile } from "./common/auth.js";
import { getStudentClasses, joinClassByPin, getStudentResults, getClassAssignments, db } from "./common/db.js";

import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { GAMES, TOPICS, $, escapeHtml, formatDate, getUrlParams } from './common/utils.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getLeague, MEDALS_CATALOG } from './common/gamification.js';

let myClasses = [];

// ── Guard ───────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const name = profile.displayNameAnonymized || profile.displayName || 'Alumno';
    $('student-welcome').textContent = `¡Hola, ${name.split(' ')[0]}! 👋`;

    checkNoAccessAlert();
    await loadClasses(user);
    await loadAssignments(user);
    await loadExams(user);
    await loadHistory(user);
    await loadTheoryHistory(user);
    setupModals(user);
    
  }
});

// ── Mostrar aviso si venía sin acceso a un juego ────────────────
function checkNoAccessAlert() {
  const { noAccess } = getUrlParams();
  if (!noAccess) return;
  const game = GAMES[noAccess];
  const alertEl = $('no-access-alert');
  const msgEl   = $('no-access-msg');
  if (alertEl && msgEl && game) {
    msgEl.innerHTML = `No tienes acceso a <strong>${escapeHtml(game.name)}</strong> ${game.icon}. 
      Tu docente aún no ha habilitado ese juego en ninguna de tus clases.`;
    alertEl.style.display = 'flex';
  }
}

// ── Cargar clases del alumno ────────────────────────────────────
async function loadClasses(user) {
  try {
    myClasses = await getStudentClasses(user.uid);
    renderStudentClasses(myClasses);
    updateStats(myClasses);
  } catch (err) {
    console.error('Error cargando clases:', err);
    showToast('Error', 'No se pudieron cargar tus clases.', 'error');
  }
}

function renderStudentClasses(classes) {
  const list    = $('student-classes-list');
  const noMsg   = $('no-classes-msg');
  if (!list) return;

  if (classes.length === 0) {
    list.innerHTML = '';
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  list.innerHTML = classes.map(cls => renderStudentClassCard(cls)).join('');
}

function renderStudentClassCard(cls) {
  const enabledGames = cls.enabledGames || [];
  const enabledTopics = cls.enabledTopics || [];

  if (enabledGames.length === 0 && enabledTopics.length === 0) {
    return `
      <div class="class-card">
        <div class="class-card-header">
          <h3 class="class-card-name">${escapeHtml(cls.name)}</h3>
        </div>
        <p class="empty-state" style="padding:var(--space-4) 0; font-size:var(--text-sm)">
          Ningún contenido o juego habilitado en esta clase todavía.
        </p>
      </div>`;
  }

  const topicCards = enabledTopics.map(tid => {
    const t = TOPICS[tid];
    if (!t) return '';
    // Como las páginas del temario estarán en root/temario/blockN.html
    return `
      <a class="game-card" href="${t.htmlPath}" 
         style="--game-color:${t.color}; --game-color-dark:${t.color}; filter: brightness(1.1);">
        <div class="game-card-icon">${t.icon}</div>
        <div class="game-card-name">${escapeHtml(t.name)}</div>
        <div class="game-card-desc">Ver temario</div>
      </a>`;
  }).join('');

  const gameCards = enabledGames.map(gid => {
    const g = GAMES[gid];
    if (!g) return '';
    return `
      <a class="game-card" href="${g.gamePath}?classId=${cls.id}"
         style="--game-color:${g.color}; --game-color-dark:${g.colorDark}">
        <div class="game-card-icon">${g.icon}</div>
        <div class="game-card-name">${escapeHtml(g.name)}</div>
        <div class="game-card-desc">${escapeHtml(g.description)}</div>
      </a>`;
  }).join('');

  let badges = [];
  if (enabledTopics.length > 0) badges.push(`📚 ${enabledTopics.length} tema${enabledTopics.length !== 1 ? 's' : ''}`);
  if (enabledGames.length > 0) badges.push(`🎮 ${enabledGames.length} juego${enabledGames.length !== 1 ? 's' : ''}`);

  return `
    <div class="class-card">
      <div class="class-card-header">
        <h3 class="class-card-name">${escapeHtml(cls.name)}</h3>
        <div style="display:flex; gap:8px;">
          ${badges.map(b => `<span class="badge badge--accent">${b}</span>`).join('')}
        </div>
      </div>
      
      ${topicCards ? `
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin:15px 0 10px 0; border-bottom:1px solid var(--border-subtle); padding-bottom:5px;">📚 Bloques Temáticos (Teoría)</h4>
        <div class="games-grid student-games-grid" style="margin-bottom:20px;">${topicCards}</div>
      ` : ''}
      
      ${gameCards ? `
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin:15px 0 10px 0; border-bottom:1px solid var(--border-subtle); padding-bottom:5px;">🎮 Juegos Educativos (Práctica)</h4>
        <div class="games-grid student-games-grid">${gameCards}</div>
      ` : ''}
    </div>`;
}

// ── Stats ───────────────────────────────────────────────────────
function updateStats(classes) {
  const totalGames = new Set(classes.flatMap(c => c.enabledGames || [])).size;
  $('stat-my-classes').textContent     = classes.length;
  $('stat-available-games').textContent = totalGames;
}

// ── Tareas pendientes del alumno ────────────────────────────────
async function loadAssignments(user) {
  const container = $('student-assignments-list');
  const section   = $('section-assignments');
  if (!container || !section) return;

  try {
    // Recoger todas las tareas de todas las clases del alumno
    const allAssignments = [];
    for (const cls of myClasses) {
      const assignments = await getClassAssignments(cls.id);
      for (const a of assignments) {
        allAssignments.push({ ...a, classId: cls.id, className: cls.name });
      }
    }

    if (allAssignments.length === 0) return; // No hay tareas → sección oculta

    // Mostrar la sección ya (con puntuación 0) para que no se quede en blanco
    section.style.display = 'block';
    container.innerHTML = allAssignments.map(a => renderAssignmentCard({ ...a, bestScore: 0 })).join('');

    // Obtener TODAS las partidas del alumno de una sola consulta (evita índices compuestos)
    const allResults = await getStudentResults(user.uid, 500);

    // Calcular el mejor score por (classId, gameId) en memoria
    const bestByKey = {};
    for (const r of allResults) {
      const key = `${r.classId}__${r.gameId}`;
      if (!bestByKey[key] || r.score > bestByKey[key]) {
        bestByKey[key] = r.score;
      }
    }

    // Enriquecer con las puntuaciones reales
    const withProgress = allAssignments.map(a => ({
      ...a,
      bestScore: bestByKey[`${a.classId}__${a.gameId}`] || 0
    }));

    // Ordenar: primero las no superadas, luego las completadas
    withProgress.sort((a, b) => {
      const aDone = a.bestScore >= a.targetScore;
      const bDone = b.bestScore >= b.targetScore;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (a.className || '').localeCompare(b.className || '');
    });

    container.innerHTML = withProgress.map(a => renderAssignmentCard(a)).join('');
  } catch (err) {
    console.error('Error cargando tareas:', err);
  }
}


function renderAssignmentCard(a) {
  const g = GAMES[a.gameId] || { icon: '🎮', name: a.gameId, gamePath: `${a.gameId}/index.html` };
  const pct     = Math.min(100, Math.round((a.bestScore / a.targetScore) * 100));
  const done    = a.bestScore >= a.targetScore;
  const gameUrl = `${g.gamePath}?classId=${a.classId}`;

  const progressBar = done
    ? `<div style="display:flex; align-items:center; gap:var(--space-2)">
         <span class="badge badge--success" style="font-size:var(--text-sm)">✅ Completada</span>
         <span style="color:var(--text-muted); font-size:var(--text-xs)">${a.bestScore} / ${a.targetScore} pts</span>
       </div>`
    : `<div style="margin-top:var(--space-2)">
         <div style="display:flex; justify-content:space-between; font-size:var(--text-xs); color:var(--text-muted); margin-bottom:4px">
           <span>${a.bestScore} / ${a.targetScore} pts</span>
           <span>${pct}%</span>
         </div>
         <div style="background:var(--border); border-radius:99px; height:8px; overflow:hidden">
           <div style="background:var(--primary); width:${pct}%; height:100%; border-radius:99px; transition:width 0.4s ease"></div>
         </div>
       </div>`;

  return `
    <div class="card" style="margin-bottom:var(--space-3); padding:var(--space-4)">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap">
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-1)">
            <span style="font-size:1.4rem">${g.icon}</span>
            <div>
              <strong style="display:block">${escapeHtml(a.title)}</strong>
              <small style="color:var(--text-muted)">${escapeHtml(a.className)} · ${escapeHtml(g.name)}</small>
            </div>
          </div>
          ${progressBar}
        </div>
        ${!done ? `<a class="btn btn-primary btn--sm" href="${gameUrl}" style="white-space:nowrap; align-self:center">▶ Jugar</a>` : ''}
      </div>
    </div>`;
}

// ── Historial de partidas ────────────────────────────────────────
async function loadHistory(user) {
  try {
    const results = await getStudentResults(user.uid, 20);
    const tbody   = $('history-tbody');
    const table   = $('history-table');
    const empty   = $('history-empty');

    if (!tbody) return;

    if (results.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    // Mejor puntuación global
    const best = Math.max(...results.map(r => r.score || 0));
    $('stat-total-score').textContent = best;

    table.style.display = 'table';
    empty.style.display = 'none';
    tbody.innerHTML = results.map(r => {
      const g = GAMES[r.gameId] || { icon: '🎮', name: r.gameId };
      const cls = myClasses.find(c => c.id === r.classId);
      return `<tr>
        <td>${g.icon} ${escapeHtml(g.name)}</td>
        <td class="ranking-score">${r.score}</td>
        <td>${cls ? escapeHtml(cls.name) : '—'}</td>
        <td style="color:var(--text-muted); font-size:var(--text-xs)">${formatDate(r.timestamp)}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error cargando historial:', err);
  }
}

// ── Modal: Unirse a clase ────────────────────────────────────────
function setupModals(user) {
  const modal     = $('modal-join-class');
  const btnOpen   = $('btn-join-class');
  const btnClose  = $('close-join-modal');
  const btnCancel = $('cancel-join');
  const form      = $('form-join-class');
  const pinInput  = $('pin-input');

  const openModal  = () => { pinInput.value = ''; $('join-error').textContent = ''; modal.setAttribute('aria-hidden', 'false'); pinInput.focus(); };
  const closeModal = () => modal.setAttribute('aria-hidden', 'true');

  btnOpen?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Solo permitir dígitos en el PIN
  pinInput?.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    if (pin.length !== 6) {
      $('join-error').textContent = 'El PIN debe tener exactamente 6 dígitos.';
      return;
    }
    try {
      showLoading('Uniéndote a la clase...');
      const cls = await joinClassByPin(user.uid, pin);
      closeModal();
      showToast('¡Te has unido!', `Ahora formas parte de "${cls.name}".`, 'success');
      myClasses = await getStudentClasses(user.uid);
      renderStudentClasses(myClasses);
      updateStats(myClasses);
    } catch (err) {
      $('join-error').textContent = err.message;
    } finally {
      hideLoading();
    }
  });
}

// ── Exámenes Test del alumno ────────────────────────────────────
async function loadExams(user) {
  try {
    const secActive = $('section-active-exams');
    const secHistory = $('section-history-exams');
    const listActive = $('active-exams-list');
    const listHistory = $('history-exams-list');
    
    if (!secActive || !secHistory || myClasses.length === 0) return;

    let htmlActive = '';
    let htmlHistory = '';
    let countActive = 0;
    let countHistory = 0;

    for (const cls of myClasses) {
      // Buscar exámenes para esta clase
      const qEx = query(collection(db, "examenes_test"), where("claseId", "==", cls.id), where("estado", "in", ["activo", "cerrado"]));
      const snapEx = await getDocs(qEx);
      
      for (const d of snapEx.docs) {
        const ex = d.data();
        
        const qRes = query(collection(db, "respuestas_test"), where("examenId", "==", d.id), where("uid", "==", user.uid));
        const snapRes = await getDocs(qRes);
        const entregado = !snapRes.empty;
        
        const numQ = ex.preguntas ? ex.preguntas.length : 0;
        const isPending = !entregado && ex.estado === 'activo';
        
        if (isPending) {
          countActive++;
          htmlActive += `
            <div class="card" style="border-left: 4px solid var(--primary);">
              <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-2);">
                <span style="font-size: 1.5rem;">📝</span>
                <h3 style="margin: 0; font-size: 1.1rem;">${escapeHtml(ex.titulo)}</h3>
              </div>
              <div style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-2);">
                <strong>Clase:</strong> ${escapeHtml(cls.name)}
              </div>
              <div style="display:flex; justify-content: space-between; font-size: var(--text-sm); background: var(--bg-surface); padding: var(--space-2); border-radius: var(--radius-sm); margin-bottom: var(--space-3);">
                <span><i class="fas fa-list-ol"></i> ${numQ} preg.</span>
                <span><i class="fas fa-clock"></i> ${ex.tiempoMinutos} min.</span>
              </div>
              <a href="examen.html?id=${d.id}" class="btn btn-primary" style="display: block; width: 100%; text-align: center;">▶ Entrar al Examen</a>
            </div>
          `;
        } else {
          countHistory++;
          let actionHtml = '';
          if (entregado) {
            if (ex.resultadosPublicados) {
              actionHtml = `<a href="examen.html?id=${d.id}" class="btn btn-ghost btn--sm" style="border: 2px solid var(--success); color: var(--success); padding: 5px 10px;">📊 Ver nota</a>`;
            } else {
              actionHtml = `<span style="color: var(--success); font-weight: bold;">✅ Entregado</span>`;
            }
          } else {
            actionHtml = `<span style="color: var(--error); font-weight: bold;">❌ Cerrado</span>`;
          }
          
          htmlHistory += `
            <tr>
              <td style="font-weight:bold; text-align:left;">
                 ${escapeHtml(ex.titulo)}
                 <div style="font-size: 0.85em; color: var(--text-muted); font-weight:normal; margin-top:4px;">⏱️ ${ex.tiempoMinutos} min.</div>
              </td>
              <td style="text-align:left;">${escapeHtml(cls.name)}</td>
              <td style="text-align:center;">${numQ}</td>
              <td style="text-align:right;">${actionHtml}</td>
            </tr>
          `;
        }
      }
    }

    if (countActive > 0) {
      secActive.style.display = 'block';
      listActive.innerHTML = htmlActive;
    }
    
    if (countHistory > 0) {
      secHistory.style.display = 'block';
      listHistory.innerHTML = htmlHistory;
    }
    
  } catch (error) {
    console.error("Error loading exams:", error);
  }
}



async function loadTheoryHistory(user) {
  try {
    const q = query(collection(db, "tic2_tests_teoria"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      $('section-theory').style.display = 'none';
      return;
    }
    
    let results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    
    // Sort chronological to assign attempt numbers
    results.sort((a, b) => {
      const ta = a.fecha && a.fecha.toMillis ? a.fecha.toMillis() : 0;
      const tb = b.fecha && b.fecha.toMillis ? b.fecha.toMillis() : 0;
      return ta - tb;
    });
    
    // Group by topic and assign attempt numbers
    let attemptsCount = {};
    results.forEach(r => {
       const key = r.topicKey;
       attemptsCount[key] = (attemptsCount[key] || 0) + 1;
       r.attemptNumber = attemptsCount[key];
       r.isLastAttempt = false; // We will mark the last one
    });
    
    // Mark the last attempts
    for (const key in attemptsCount) {
       const lastAttempt = results.slice().reverse().find(r => r.topicKey === key);
       if (lastAttempt) lastAttempt.isLastAttempt = true;
    }
    
    // Sort descending by date for display
    results.sort((a, b) => {
      const ta = a.fecha && a.fecha.toMillis ? a.fecha.toMillis() : 0;
      const tb = b.fecha && b.fecha.toMillis ? b.fecha.toMillis() : 0;
      return tb - ta;
    });
    
    const tbody = $('theory-tbody');
    let html = '';
    
    results.forEach(r => {
      const isPassed = r.score >= 5;
      const isGold = r.score >= 9;
      let scoreBadge = '';
      if (isGold) scoreBadge = `<span class="badge badge--success">⭐ ${r.score}</span>`;
      else if (isPassed) scoreBadge = `<span class="badge" style="background:#2ecc71; color:white;">${r.score}</span>`;
      else scoreBadge = `<span class="badge badge--error">${r.score}</span>`;
      
      let fDate = "Desconocida";
      if (r.fecha && r.fecha.toDate) {
         fDate = r.fecha.toDate().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      }
      
      let intentBadge = r.isLastAttempt 
         ? `<span class="badge" style="background:var(--accent); color:var(--text-primary); font-size:0.7em;">INTENTO ${r.attemptNumber} (VÁLIDO)</span>`
         : `<span class="badge badge--outline" style="font-size:0.7em;">Intento ${r.attemptNumber}</span>`;
      
      html += `
        <tr ${r.isLastAttempt ? 'style="background: rgba(255, 178, 239, 0.1);"' : 'style="opacity: 0.7;"'}>
          <td style="font-weight:bold;">
             ${escapeHtml(r.topicTitle || r.topicKey)}<br>
             ${intentBadge}
          </td>
          <td>${r.rawScore} / ${r.maxPossible}</td>
          <td>${scoreBadge}</td>
          <td style="font-size:0.85em; color:var(--text-muted);">${fDate}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
    $('section-theory').style.display = 'block';
  } catch (e) {
    console.error("Error loading theory history:", e);
  }
}

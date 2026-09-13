// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — dashboard_student.js
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile } from './common/auth.js';
import { getStudentClasses, joinClassByPin, getStudentResults, getClassAssignments } from './common/db.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { GAMES, TOPICS, $, escapeHtml, formatDate, getUrlParams } from './common/utils.js';

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
    await loadHistory(user);
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
      <a class="game-card" href="${t.htmlPath}" target="_blank"
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

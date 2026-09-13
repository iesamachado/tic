import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, isAdmin } from './common/auth.js';
import {
  getClass, updateClass, getClassMembers, getClassAssignments,
  toggleGameInClass, toggleTopicInClass, createAssignment, updateAssignment, deleteAssignment,
  getClassRanking, addStudentsToClass, removeStudentFromClass, getStudentResultsInClass,
  getStudentBestScore
} from './common/db.js';
import { createClassroomAssignment, syncClassroomGrades } from './common/classroom.js';
import { renderHeader, showToast, showLoading, hideLoading, renderPodium, renderRankingTable } from './common/ui.js';
import { GAMES, TOPICS, $, $$, escapeHtml, formatDate, getUrlParams, copyToClipboard } from './common/utils.js';

let classData = null;
let members   = [];
let activeTab = 'games';
let activeGameFilter = '';

// ── Guard ───────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const { classId } = getUrlParams();
    if (!classId) { window.location.href = 'dashboard_teacher.html'; return; }

    try {
      classData = await getClass(classId);
      const isOwner = classData && classData.teacherId === user.uid;
      const userIsAdmin = isAdmin(user, profile);

      if (!classData || (!isOwner && !userIsAdmin)) {
        showToast('Acceso denegado', 'No tienes acceso a esta clase.', 'error');
        setTimeout(() => window.location.href = 'dashboard_teacher.html', 2000);
        return;
      }

      initPage(user, profile);
      await loadGamesTab();
      await loadTopicsTab();
    } catch (err) {
      console.error(err);
      showToast('Error', 'No se pudo cargar la clase.', 'error');
    }
  }
});

// ── Inicialización ──────────────────────────────────────────────
function initPage(user, profile) {
  // Cabecera
  $('class-name').textContent = classData.name;
  const pinBtn = $('class-pin');
  if (pinBtn) {
    pinBtn.textContent = `📋 ${classData.pin}`;
    pinBtn.addEventListener('click', async () => {
      await copyToClipboard(classData.pin);
      showToast('PIN copiado', classData.pin, 'success', 2000);
    });
  }
  if (classData.classroomCourseId) {
    $('classroom-link-meta')?.style && ($('classroom-link-meta').style.display = 'flex');
  }

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      $$('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      $$('.tab-content').forEach(s => s.style.display = 'none');
      const tab = btn.dataset.tab;
      $(`tab-${tab}`).style.display = 'block';
      activeTab = tab;

      if (tab === 'students')    await loadStudentsTab();
      if (tab === 'assignments') await loadAssignmentsTab();
      if (tab === 'results')     await loadResultsTab();
    });
  });

  setupModals(user);
}

// ══════════════════════════════════════════════════════════════
//  TAB: JUEGOS
// ══════════════════════════════════════════════════════════════

async function loadGamesTab() {
  const list = $('games-toggle-list');
  if (!list) return;

  const enabled = classData.enabledGames || [];

  list.innerHTML = Object.values(GAMES).map(g => `
    <div class="game-toggle-row" id="game-row-${g.id}">
      <div class="game-toggle-info">
        <span class="game-toggle-icon">${g.icon}</span>
        <div>
          <strong>${escapeHtml(g.name)}</strong>
          <small>${escapeHtml(g.description)}</small>
        </div>
      </div>
      <div class="game-toggle-actions">
        <a class="btn btn-ghost btn--sm" href="${g.gamePath}?classId=${classData.id}" target="_blank">🎮 Probar</a>
        <label class="toggle-switch" title="${enabled.includes(g.id) ? 'Desactivar' : 'Activar'}">
          <input type="checkbox" 
                 id="toggle-${g.id}"
                 data-game-id="${g.id}"
                 ${enabled.includes(g.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>`).join('');

  // Eventos toggle
  $$('[data-game-id]').forEach(input => {
    input.addEventListener('change', async () => {
      const gameId = input.dataset.gameId;
      const active = input.checked;
      try {
        await toggleGameInClass(classData.id, gameId, active);
        if (active) {
          classData.enabledGames = [...(classData.enabledGames || []), gameId];
        } else {
          classData.enabledGames = (classData.enabledGames || []).filter(g => g !== gameId);
        }
        showToast(
          active ? `${GAMES[gameId].icon} ${GAMES[gameId].name} activado` : `${GAMES[gameId].name} desactivado`,
          '',
          active ? 'success' : 'info',
          2000
        );
      } catch (err) {
        input.checked = !active; // Revertir
        showToast('Error', err.message, 'error');
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  TAB: TEMARIO Y JUEGOS (sección temas)
// ══════════════════════════════════════════════════════════════

async function loadTopicsTab() {
  const list = $('topics-toggle-list');
  if (!list) return;

  const enabled = classData.enabledTopics || [];

  list.innerHTML = Object.values(TOPICS).map(t => `
    <div class="game-toggle-row" id="topic-row-${t.id}">
      <div class="game-toggle-info">
        <span class="game-toggle-icon">${t.icon}</span>
        <div>
          <strong>${escapeHtml(t.name)}</strong>
          <small>${escapeHtml(t.description)}</small>
        </div>
      </div>
      <div class="game-toggle-actions">
        <label class="toggle-switch" title="${enabled.includes(t.id) ? 'Ocultar' : 'Mostrar'}">
          <input type="checkbox" 
                 id="toggle-topic-${t.id}"
                 data-topic-id="${t.id}"
                 ${enabled.includes(t.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>`).join('');

  // Eventos toggle para temas
  $$('[data-topic-id]').forEach(input => {
    input.addEventListener('change', async () => {
      const topicId = input.dataset.topicId;
      const active = input.checked;
      try {
        await toggleTopicInClass(classData.id, topicId, active);
        if (active) {
          classData.enabledTopics = [...(classData.enabledTopics || []), topicId];
        } else {
          classData.enabledTopics = (classData.enabledTopics || []).filter(t => t !== topicId);
        }
        showToast(
          active ? `${TOPICS[topicId].icon} ${TOPICS[topicId].name} activado` : `${TOPICS[topicId].name} desactivado`,
          '',
          active ? 'success' : 'info',
          2000
        );
      } catch (err) {
        input.checked = !active; // Revertir
        showToast('Error', err.message, 'error');
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  TAB: ALUMNOS
// ══════════════════════════════════════════════════════════════

async function loadStudentsTab() {
  const list = $('students-list');
  const noMsg = $('no-students');
  if (!list) return;

  try {
    members = await getClassMembers(classData.id);

    if (members.length === 0) {
      list.innerHTML = '';
      noMsg.style.display = 'block';
      return;
    }

    noMsg.style.display = 'none';
    list.innerHTML = `
      <div class="students-list-header">
        <span>${members.length} alumno${members.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="students-list-body">
        ${members.map(m => renderStudentRow(m)).join('')}
      </div>`;

    // Eventos de eliminación
    list.querySelectorAll('[data-action="remove-student"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.studentId;
        const studentName = btn.dataset.studentName || 'este alumno';
        if (!confirm(`¿Eliminar a ${studentName} de la clase?`)) return;

        try {
          showLoading('Eliminando alumno...');
          await removeStudentFromClass(classData.id, studentId);
          showToast('Alumno eliminado', `${studentName} ya no pertenece a la clase.`, 'info');
          await loadStudentsTab();
        } catch (err) {
          showToast('Error', err.message, 'error');
        } finally {
          hideLoading();
        }
      });
    });

    // Eventos de historial
    list.querySelectorAll('[data-action="view-history"]').forEach(btn => {
      btn.addEventListener('click', () => {
        showStudentHistory(btn.dataset.studentId, btn.dataset.studentName || 'Alumno');
      });
    });
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderStudentRow(m) {
  const displayName = m.displayNameAnonymized || m.displayName || m.name || m.email || 'Alumno';
  const identifier = m.uid || m.email;

  if (m.pending) {
    return `<div class="student-row student-row--pending" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3); border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:var(--space-3);">
        <div class="student-row-avatar student-row-avatar--pending">⏳</div>
        <div class="student-row-info">
          <strong>${escapeHtml(m.name || m.email)}</strong>
          <small style="display:block; color:var(--text-muted);">${escapeHtml(m.email)} — <em>Pendiente de registro</em></small>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:var(--space-2);">
        <span class="badge badge--warning">Pendiente</span>
        <button class="btn btn-ghost btn--sm" data-action="remove-student" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(m.email)}" title="Eliminar de la clase" style="color:var(--error); padding:4px 8px;">
          🗑️
        </button>
      </div>
    </div>`;
  }

  return `<div class="student-row" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3); border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:var(--space-3);">
      <img class="student-row-avatar"
           src="${escapeHtml(m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}`)}"
           alt="${escapeHtml(displayName)}"
           onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}'">
      <div class="student-row-info">
        <strong>${escapeHtml(displayName)}</strong>
        <small style="display:block; color:var(--text-muted);">${escapeHtml(m.email || '')}</small>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:var(--space-2);">
      <span class="badge ${m.source === 'classroom' ? 'badge--accent' : 'badge--muted'}">
        ${m.source === 'classroom' ? 'Classroom' : 'Directo / PIN'}
      </span>
      <button class="btn btn-ghost btn--sm" data-action="view-history" data-student-id="${escapeHtml(m.uid)}" data-student-name="${escapeHtml(displayName)}" title="Ver historial de partidas" style="padding:4px 8px;">
        📊
      </button>
      <button class="btn btn-ghost btn--sm" data-action="remove-student" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(displayName)}" title="Eliminar de la clase" style="color:var(--error); padding:4px 8px;">
        🗑️
      </button>
    </div>
  </div>`;
}

async function showStudentHistory(studentId, studentName) {
  if (!studentId) {
    showToast('Error', 'ID de alumno no disponible.', 'error');
    return;
  }
  const GAME_NAMES = Object.fromEntries(Object.values(GAMES).map(g => [g.id, `${g.icon} ${g.name}`]));

  let modal = document.getElementById('modal-student-history');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-student-history';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:680px; width:95%;">
        <div class="modal-header">
          <h3 id="history-modal-title"></h3>
          <button class="modal-close" id="close-history-modal" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body" style="padding:0;">
          <div id="history-modal-body" style="overflow-x:auto;"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('close-history-modal').addEventListener('click', () => modal.classList.remove('modal-backdrop--visible'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal-backdrop--visible'); });
  }

  document.getElementById('history-modal-title').textContent = `📊 Historial de ${studentName}`;
  document.getElementById('history-modal-body').innerHTML = '<div style="padding:32px; text-align:center;">⏳ Cargando partidas...</div>';
  modal.classList.add('modal-backdrop--visible');

  let results = [];
  try {
    results = await getStudentResultsInClass(studentId, classData.id, 50);
  } catch(e) {
    console.error('Error cargando historial:', e);
    document.getElementById('history-modal-body').innerHTML = `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error al cargar: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const rows = results.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Sin partidas registradas en esta clase.</td></tr>'
    : results.map(r => {
        const gameName = GAME_NAMES[r.gameId] || r.gameId || '—';
        const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
        const wpm = r.metadata?.wpm ?? '—';
        const acc = r.metadata?.accuracy != null ? r.metadata.accuracy + '%' : '—';
        return `<tr>
          <td style="padding:8px 12px;">${escapeHtml(gameName)}</td>
          <td style="padding:8px 12px; text-align:center;">${r.score}</td>
          <td style="padding:8px 12px; text-align:center;">${wpm !== '—' ? wpm + ' PPM' : '—'}${acc !== '—' ? ` / ${acc}` : ''}</td>
          <td style="padding:8px 12px; color:var(--text-muted); font-size:0.85rem;">${date}</td>
        </tr>`;
      }).join('');

  document.getElementById('history-modal-body').innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
      <thead>
        <tr style="border-bottom:2px solid var(--border); background:var(--surface-2);">
          <th style="padding:10px 12px; text-align:left;">Juego</th>
          <th style="padding:10px 12px; text-align:center;">Puntuación</th>
          <th style="padding:10px 12px; text-align:center;">Detalle</th>
          <th style="padding:10px 12px; text-align:left;">Fecha</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ══════════════════════════════════════════════════════════════
//  TAB: TAREAS
// ══════════════════════════════════════════════════════════════

async function loadAssignmentsTab() {
  const list = $('assignments-list');
  if (!list) return;

  try {
    const assignments = await getClassAssignments(classData.id);
    const noMsg = $('no-assignments');

    if (assignments.length === 0) {
      noMsg && (noMsg.style.display = 'block');
      return;
    }
    noMsg && (noMsg.style.display = 'none');

    list.innerHTML = assignments.map(a => {
      const g = GAMES[a.gameId] || { icon: '🎮', name: a.gameId };
      const canPublish = classData.classroomCourseId && !a.classroomCourseWorkId;
      return `<div class="assignment-row">
        <div class="assignment-info">
          <span class="assignment-game-icon">${g.icon}</span>
          <div>
            <strong>${escapeHtml(a.title)}</strong>
            <small>${escapeHtml(g.name)} · Objetivo: ${a.targetScore} pts${a.dueDate ? ` · ${formatDate({ toDate: () => new Date(a.dueDate) })}` : ''}</small>
          </div>
        </div>
        <div class="assignment-actions">
          <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                  data-game-id="${a.gameId}" data-target="${a.targetScore}"
                  data-title="${escapeHtml(a.title)}" onclick="window._viewProgress(this)">
            👥 Ver progreso
          </button>
          ${a.classroomCourseWorkId ? `
            <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                    data-game-id="${a.gameId}" data-target="${a.targetScore}"
                    data-coursework="${a.classroomCourseWorkId}" onclick="window._syncGrade(this)">
              📤 Sincronizar notas
            </button>` : ''}
          ${canPublish ? `
            <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                    data-game-id="${a.gameId}" data-target="${a.targetScore}"
                    data-title="${escapeHtml(a.title)}" data-due="${a.dueDate || ''}"
                    onclick="window._publishToClassroom(this)">
              🔗 Publicar en Classroom
            </button>` : ''}
          <span class="badge ${a.classroomCourseWorkId ? 'badge--accent' : 'badge--muted'}">
            ${a.classroomCourseWorkId ? '🔗 Classroom' : 'Solo ClassHub'}
          </span>
        </div>
      </div>`;
    }).join('');

    // Handler de ver progreso de la tarea
    window._viewProgress = async (btn) => {
      const { gameId, target, title } = btn.dataset;
      const targetScore = parseInt(target);

      // Crear o reutilizar el modal de progreso
      let modal = document.getElementById('modal-assignment-progress');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-assignment-progress';
        modal.className = 'modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="modal-box" style="max-width:700px; width:95%;">
            <div class="modal-header">
              <h3 id="progress-modal-title"></h3>
              <button class="modal-close" id="close-progress-modal" aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-body" style="padding:0;">
              <div id="progress-modal-body" style="overflow-x:auto;"></div>
            </div>
          </div>`;
        document.body.appendChild(modal);
        document.getElementById('close-progress-modal').addEventListener('click', () => modal.classList.remove('modal-backdrop--visible'));
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal-backdrop--visible'); });
      }

      document.getElementById('progress-modal-title').textContent = `👥 Progreso: ${title}`;
      document.getElementById('progress-modal-body').innerHTML = '<div style="padding:32px; text-align:center;">⏳ Cargando...</div>';
      modal.classList.add('modal-backdrop--visible');

      try {
        // Cargar miembros y sus puntuaciones en paralelo
        const currentMembers = members.length > 0 ? members : await getClassMembers(classData.id);
        const activeMembers = currentMembers.filter(m => !m.pending);

        const rows = await Promise.all(activeMembers.map(async m => {
          const score = await getStudentBestScore(m.uid, gameId, classData.id);
          const grade = Math.min(10, Math.round((score / targetScore) * 10 * 10) / 10);
          const pct   = Math.min(100, Math.round((score / targetScore) * 100));
          const done  = score >= targetScore;
          const name  = m.displayNameAnonymized || m.displayName || m.email || 'Alumno';

          let statusBadge;
          if (done)        statusBadge = '<span class="badge badge--success">✅ Superada</span>';
          else if (score > 0) statusBadge = '<span class="badge badge--warning">⏳ En progreso</span>';
          else             statusBadge = '<span class="badge badge--muted">❌ Sin jugar</span>';

          return { name, score, grade, pct, done, statusBadge };
        }));

        // Ordenar: completadas abajo, sin jugar arriba
        rows.sort((a, b) => {
          if (a.done !== b.done) return b.done ? -1 : 1;
          return b.score - a.score;
        });

        if (activeMembers.length === 0) {
          document.getElementById('progress-modal-body').innerHTML =
            '<p class="empty-state" style="padding:24px">No hay alumnos registrados en esta clase.</p>';
          return;
        }

        // Estadísticas resumen
        const nDone   = rows.filter(r => r.done).length;
        const nPlayed = rows.filter(r => r.score > 0 && !r.done).length;
        const nNone   = rows.filter(r => r.score === 0).length;

        document.getElementById('progress-modal-body').innerHTML = `
          <div style="display:flex; gap:var(--space-4); padding:var(--space-4); border-bottom:1px solid var(--border); flex-wrap:wrap;">
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--success)">${nDone}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">Superada</div>
            </div>
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--warning)">${nPlayed}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">En progreso</div>
            </div>
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--text-muted)">${nNone}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">Sin jugar</div>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border); background:var(--surface-2);">
                <th style="padding:10px 12px; text-align:left;">Alumno</th>
                <th style="padding:10px 12px; text-align:center;">Puntuación</th>
                <th style="padding:10px 12px; text-align:center;">Nota</th>
                <th style="padding:10px 12px; text-align:center;">Progreso</th>
                <th style="padding:10px 12px; text-align:center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:8px 12px;">${escapeHtml(r.name)}</td>
                  <td style="padding:8px 12px; text-align:center;">${r.score}</td>
                  <td style="padding:8px 12px; text-align:center; font-weight:600; color:${r.done ? 'var(--success)' : r.score > 0 ? 'var(--warning)' : 'var(--text-muted)'}">
                    ${r.score > 0 ? r.grade + '/10' : '—'}
                  </td>
                  <td style="padding:8px 12px; min-width:120px;">
                    <div style="background:var(--border); border-radius:99px; height:6px; overflow:hidden;">
                      <div style="background:${r.done ? 'var(--success)' : 'var(--primary)'}; width:${r.pct}%; height:100%; border-radius:99px;"></div>
                    </div>
                  </td>
                  <td style="padding:8px 12px; text-align:center;">${r.statusBadge}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      } catch (err) {
        document.getElementById('progress-modal-body').innerHTML =
          `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error: ${escapeHtml(err.message)}</div>`;
      }
    };

    // Handler de sincronizar
    window._syncGrade = async (btn) => {
      const { assignmentId, gameId, target, coursework } = btn.dataset;
      if (!classroomToken) {
        showToast('Token expirado', 'Vuelve a iniciar sesión como docente para sincronizar.', 'warning');
        return;
      }
      try {
        showLoading('Sincronizando notas...');
        const count = await syncClassroomGrades(
          classroomToken,
          classData.classroomCourseId,
          classData.id,
          coursework,
          { targetScore: parseInt(target), gameId }
        );
        showToast('Notas sincronizadas', `${count} alumno${count !== 1 ? 's' : ''} actualizado${count !== 1 ? 's' : ''} en Classroom.`, 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    };

    // Handler de publicar tarea existente en Classroom
    window._publishToClassroom = async (btn) => {
      let token = classroomToken;
      if (!token) {
        try { token = await refreshClassroomToken(); } catch { return; }
      }
      const { assignmentId, gameId, target, title, due } = btn.dataset;
      try {
        showLoading('Publicando en Classroom...');
        const settings = await import('./common/db.js').then(m => m.getSiteSettings());
        const result = await createClassroomAssignment(token, classData.classroomCourseId, classData.id, {
          gameId, title, targetScore: parseInt(target),
          dueDate: due || null,
          siteUrl: settings.siteUrl,
          skipFirestore: true
        });
        // Actualizar el documento existente en Firestore con el ID de Classroom
        await updateAssignment(classData.id, assignmentId, {
          classroomCourseId: classData.classroomCourseId,
          classroomCourseWorkId: result.id
        });
        showToast('Tarea publicada en Classroom', title, 'success');
        await loadAssignmentsTab();
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    };

  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}


// ══════════════════════════════════════════════════════════════
//  TAB: RESULTADOS
// ══════════════════════════════════════════════════════════════

async function loadResultsTab() {
  // Filter pills
  const pillsContainer = $('game-filter-pills');
  if (pillsContainer && pillsContainer.children.length === 1) {
    Object.values(GAMES).forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'filter-pill';
      btn.dataset.game = g.id;
      btn.textContent = `${g.icon} ${g.name}`;
      btn.addEventListener('click', () => setGameFilter(g.id));
      pillsContainer.appendChild(btn);
    });
    pillsContainer.querySelector('[data-game=""]')?.addEventListener('click', () => setGameFilter(''));
  }

  await renderResults();
}

async function setGameFilter(gameId) {
  activeGameFilter = gameId;
  $$('.filter-pill').forEach(p => {
    p.classList.toggle('filter-pill--active', p.dataset.game === gameId);
  });
  await renderResults();
}

async function renderResults() {
  try {
    showLoading('Cargando resultados...');
    const ranking = await getClassRanking(classData.id, activeGameFilter || null);

    // Enriquecer con perfiles
    const enriched = await Promise.all(ranking.map(async r => {
      const member = members.find(m => m.uid === r.studentId);
      return {
        ...r,
        displayNameAnonymized: member?.displayNameAnonymized || member?.displayName || 'Alumno',
        photoURL: member?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.studentId}`
      };
    }));

    renderPodium(enriched, 'results-podium');
    renderRankingTable(enriched, 'results-ranking');
  } catch (err) {
    console.error(err);
    const podium = document.getElementById('results-podium');
    if (podium) {
        podium.innerHTML = `<div class="empty-state" style="color:var(--error); padding: 20px; text-align: center;">
            ⚠️ Firebase aún está construyendo el índice de rendimiento.<br>
            Este proceso suele tardar de <strong>3 a 5 minutos</strong>.<br><br>
            <small style="color:var(--text-muted)">Detalle técnico: ${err.message}</small>
        </div>`;
    }
    const ranking = document.getElementById('results-ranking');
    if (ranking) ranking.innerHTML = '';
  } finally {
    hideLoading();
  }
}

// ══════════════════════════════════════════════════════════════
//  MODALES
// ══════════════════════════════════════════════════════════════

function setupModals(user) {



  // Modal nueva tarea
  const modalAssignment = $('modal-new-assignment');
  const formAssignment  = $('form-new-assignment');
  const btnNew          = $('btn-new-assignment');
  const closeBtn        = $('close-new-assignment');
  const cancelBtn       = $('cancel-new-assignment');

  // Rellenar select de juegos
  const gameSelect = $('assignment-game');
  if (gameSelect) {
    Object.values(GAMES).forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.icon} ${g.name}`;
      gameSelect.appendChild(opt);
    });

    gameSelect.addEventListener('change', async () => {
      const criteriaContainer = $('assignment-criteria-suggestion');
      if (!criteriaContainer) return;
      const gameId = gameSelect.value;
      
      try {
        const { GAMES_CRITERIA_MAPPING } = await import('./common/utils.js');
        const mapping = GAMES_CRITERIA_MAPPING[gameId];
        
        if (mapping) {
          criteriaContainer.innerHTML = `
            <strong>💡 Sugerencia de Criterios (Andalucía)</strong><br>
            <ul style="margin:4px 0 0 16px; padding:0;">
              <li><strong>1º ESO:</strong> ${escapeHtml(mapping['1º ESO'])}</li>
              <li><strong>2º ESO:</strong> ${escapeHtml(mapping['2º ESO'])}</li>
              <li><strong>3º ESO:</strong> ${escapeHtml(mapping['3º ESO'])}</li>
            </ul>
          `;
          criteriaContainer.style.display = 'block';
        } else {
          criteriaContainer.style.display = 'none';
        }
      } catch (e) {
        console.warn('No se pudo cargar el mapeo de criterios', e);
      }
    });
  }

  // Mostrar nota si no hay Classroom vinculado
  if (!classData.classroomCourseId) {
    $('assignment-classroom-note').style.display = 'block';
  }

  const openModal  = () => { 
    formAssignment?.reset(); 
    if ($('assignment-criteria-suggestion')) $('assignment-criteria-suggestion').style.display = 'none';
    $('assignment-error').textContent = ''; 
    modalAssignment.classList.add('modal-backdrop--visible'); 
    modalAssignment.setAttribute('aria-hidden', 'false'); 
  };
  const closeModal = () => { modalAssignment.classList.remove('modal-backdrop--visible'); modalAssignment.setAttribute('aria-hidden', 'true'); };

  btnNew?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modalAssignment?.addEventListener('click', e => { if (e.target === modalAssignment) closeModal(); });

  formAssignment?.addEventListener('submit', async e => {
    e.preventDefault();
    const gameId = $('assignment-game').value;
    const title  = $('assignment-title').value.trim();
    const target = parseInt($('assignment-target').value);
    const due    = $('assignment-due').value;

    if (!gameId || !title || !target) {
      $('assignment-error').textContent = 'Completa todos los campos obligatorios.';
      return;
    }

    try {
      showLoading('Creando tarea...');
      $('assignment-error').textContent = '';

      let classroomCourseWorkId = null;

      // Si tiene Classroom y hay token, publicar la tarea
      if (classData.classroomCourseId && classroomToken) {
        const settings = await import('./common/db.js').then(m => m.getSiteSettings());
        const result = await createClassroomAssignment(classroomToken, classData.classroomCourseId, classData.id, {
          gameId, title, targetScore: target,
          dueDate: due || null,
          siteUrl: settings.siteUrl
        });
        classroomCourseWorkId = result.id;
        showToast('Tarea publicada en Classroom', title, 'success');
      } else {
        // Solo guardar en Firestore
        await createAssignment(classData.id, {
          gameId, title, targetScore: target,
          dueDate: due || null,
          classroomCourseId: classData.classroomCourseId || null
        });
        showToast('Tarea creada', 'Guardada en ClassHub (sin Classroom).', 'success');
      }

      closeModal();
      await loadAssignmentsTab();
    } catch (err) {
      $('assignment-error').textContent = err.message;
    } finally {
      hideLoading();
    }
  });

  // Sincronizar alumnos desde Classroom
  $('btn-sync-students')?.addEventListener('click', async () => {
    if (!classData.classroomCourseId) {
      showToast('Sin Classroom', 'Esta clase no está vinculada a un curso de Classroom.', 'warning');
      return;
    }
    let token = classroomToken;
    if (!token) {
      try { token = await refreshClassroomToken(); } catch { return; }
    }
    try {
      showLoading('Sincronizando alumnos...');
      const { importClassroomStudents } = await import('./common/classroom.js');
      const { matched, pending } = await importClassroomStudents(token, classData.classroomCourseId, classData.id);
      showToast('Alumnos sincronizados', `${matched} vinculados, ${pending} pendientes de registro.`, 'success');
      await loadStudentsTab();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // Modal añadir alumnos manualmente
  const modalAddStudents  = $('modal-add-students');
  const formAddStudents   = $('form-add-students');
  const btnAddStudents    = $('btn-add-students');
  const closeAddStudents  = $('close-add-students');
  const cancelAddStudents = $('cancel-add-students');

  const openAddStudents = () => {
    formAddStudents?.reset();
    modalAddStudents?.classList.add('modal-backdrop--visible');
    modalAddStudents?.setAttribute('aria-hidden', 'false');
  };
  const closeAddModal = () => {
    modalAddStudents?.classList.remove('modal-backdrop--visible');
    modalAddStudents?.setAttribute('aria-hidden', 'true');
  };

  btnAddStudents?.addEventListener('click', openAddStudents);
  closeAddStudents?.addEventListener('click', closeAddModal);
  cancelAddStudents?.addEventListener('click', closeAddModal);
  modalAddStudents?.addEventListener('click', e => { if (e.target === modalAddStudents) closeAddModal(); });

  formAddStudents?.addEventListener('submit', async e => {
    e.preventDefault();
    const rawEmails = $('manual-students-input')?.value || '';
    if (!rawEmails.trim()) {
      showToast('Atención', 'Introduce al menos un correo electrónico.', 'warning');
      return;
    }

    try {
      showLoading('Añadiendo alumnos...');
      const result = await addStudentsToClass(classData.id, rawEmails);
      closeAddModal();

      let msg = `${result.added} alumno(s) añadido(s).`;
      if (result.alreadyInClass > 0) msg += ` (${result.alreadyInClass} ya estaban en la clase).`;
      if (result.invalidEmails > 0) msg += ` (${result.invalidEmails} correos con formato inválido).`;

      showToast('Alumnos procesados', msg, 'success', 5000);
      await loadStudentsTab();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}

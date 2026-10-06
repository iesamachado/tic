import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './common/db.js';
import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, isAdmin } from './common/auth.js';
import {
  getClass, updateClass, getClassMembers, getClassAssignments,
  toggleGameInClass, toggleTopicInClass, createAssignment, updateAssignment, deleteAssignment,
  getClassRanking, addStudentsToClass, removeStudentFromClass, getStudentResultsInClass,
  getStudentBestScore
} from './common/db.js';
import { MEDALS_CATALOG, GUILDS_CATALOG } from './common/gamification.js';
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
      members = await getClassMembers(classData.id);
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
      if (tab === 'gamification') await loadGamificationTab();
      if (tab === 'assignments') await loadAssignmentsTab();
      if (tab === 'results')     await loadResultsTab();
      if (tab === 'exams')       await loadExamsTab();
      if (tab === 'theory')      await loadTheoryTab();
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
      
      <div class="game-toggle-actions" style="display:flex; align-items:center; gap:10px;">
        <a href="${t.htmlPath}" target="_blank" class="btn btn-ghost btn--sm" title="Abrir y ver temario" style="text-decoration:none; padding:4px 8px;">👀 Ver</a>
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


async function loadGamificationTab() {
  try {
    members = await getClassMembers(classData.id);
    renderGamificationDashboard(members, classData.id);
  } catch(e) {
    console.error('Error al cargar gamificación', e);
  }
}

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
        showModal('Eliminar Alumno', `¿Eliminar a ${studentName} de la clase?`, async () => {
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
  const displayName = m.displayNameAnonymized || m.displayName || m.name || m.email?.split('@')[0] || 'Alumno';
  const identifier = m.uid || m.email || m.id;
  const pts = m.puntosTotal || m.totalScore || 0;
  const medalsCount = m.logros ? m.logros.length : 0;

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
    <div style="display:flex; align-items:center; gap:var(--space-3); flex: 1;">
      <img class="student-row-avatar"
           src="${escapeHtml(m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${identifier}`)}"
           alt="${escapeHtml(displayName)}"
           onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${identifier}'">
      <div class="student-row-info">
        <strong>${escapeHtml(displayName)}</strong>
        <small style="display:block; color:var(--text-muted);">${escapeHtml(m.email || '')}</small>
      </div>
    </div>
    
    <div style="display:flex; align-items:center; gap:var(--space-3); margin-right: 15px;">
      <div style="text-align: right; min-width: 100px;">
        <span style="font-weight: bold; color: #f39c12; font-size: 1.1rem;">⭐ ${pts} pts</span><br>
        <span style="font-size: 0.85rem; color: #7f8c8d;">🏅 ${medalsCount} medallas</span>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:var(--space-2);">
      <span class="badge ${m.source === 'classroom' ? 'badge--accent' : 'badge--muted'}">
        ${m.source === 'classroom' ? 'Classroom' : 'Directo / PIN'}
      </span>
      <button class="btn btn-ghost btn--sm" onclick="window._showMedallas('${escapeHtml(identifier)}')" title="Ver medallas" style="padding:4px 8px; font-size:1.2rem;">
        🏅
      </button>
      <button class="btn btn-ghost btn--sm" data-action="view-history" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(displayName)}" title="Ver historial de partidas" style="padding:4px 8px;">
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
    const enrichedRaw = await Promise.all(ranking.map(async r => {
      let member = members.find(m => m.uid === r.studentId);
      
      // Si el jugador no está en la lista de alumnos (ej: es el profesor jugando), buscamos su perfil
      if (!member) {
        try {
          const { getUserProfile } = await import('./common/db.js');
          const profile = await getUserProfile(r.studentId);
          if (profile) member = profile;
        } catch(e) {}
      }

      return {
        ...r,
        role: member?.role || 'student',
        displayNameAnonymized: member?.displayNameAnonymized || member?.displayName || member?.name || member?.email?.split('@')[0] || 'Desconocido',
        photoURL: member?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.studentId}`
      };
    }));

    const enriched = enrichedRaw.filter(r => r.role !== 'teacher' && r.role !== 'admin');

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



  // Modal: Generar Examen Test
  const modalExam = $('modal-new-exam');
  const btnNewExam = $('btn-new-exam');
  
  if ($('gen-topic')) {
    let html = '<option value="">Todos los bloques</option>';
    for (const key in TOPICS) {
      html += `<option value="${key}">${TOPICS[key].name}</option>`;
    }
    $('gen-topic').innerHTML = html;
  }
  btnNewExam?.addEventListener('click', () => {
    $('gen-titulo').value = '';
    $('gen-preview-container').style.display = 'none';
    currentPreviewPreguntas = [];
    $('btn-save-examen').disabled = true;
    modalExam.classList.add('modal-backdrop--visible');
  });
  
  $('btn-close-new-exam')?.addEventListener('click', () => modalExam.classList.remove('modal-backdrop--visible'));
  $('btn-cancel-new-exam')?.addEventListener('click', () => modalExam.classList.remove('modal-backdrop--visible'));

  $('btn-preview-examen')?.addEventListener('click', async () => {
    const topic = $('gen-topic').value;
    const num = parseInt($('gen-num').value);

    try {
      showLoading('Buscando preguntas...');
      const q = query(collection(db, "preguntas"));
      const snap = await getDocs(q);
      
      let validQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (topic) {
        validQuestions = validQuestions.filter(p => p.topic === topic);
      }

      if (validQuestions.length === 0) {
        showToast('Atención', 'No hay preguntas en el banco para este filtro.', 'warning');
        return;
      }

      validQuestions.sort(() => Math.random() - 0.5);
      currentPreviewPreguntas = validQuestions.slice(0, num);

      $('gen-preview-container').style.display = 'block';
      $('gen-preview-count').textContent = currentPreviewPreguntas.length;
      $('gen-preview-list').innerHTML = currentPreviewPreguntas.map((p, i) => {
        const topicName = p.topic && TOPICS[p.topic] ? TOPICS[p.topic].name : (p.topic || 'Sin bloque');
        return `
        <div style="margin-bottom: var(--space-2); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border);">
          <strong>${i+1}.</strong> <span class="badge badge--primary" style="font-size:0.7em;">${topicName}</span> ${p.enunciado}
        </div>
      `}).join('');

      $('btn-save-examen').disabled = false;
    } catch (e) {
      console.error(e);
      showToast('Error', 'Error al cargar preguntas', 'error');
    } finally {
      hideLoading();
    }
  });

  $('btn-save-examen')?.addEventListener('click', async () => {
    const titulo = $('gen-titulo').value || 'Examen Test';
    const tiempo = parseInt($('gen-tiempo').value);

    try {
      showLoading('Guardando examen...');

      const examenData = {
        claseId: classData.id,
        titulo,
        tiempoMinutos: tiempo,
        estado: 'oculto',
        creadoEn: serverTimestamp()
      };

      // Limpiar datos sensibles
      const preguntasSeguras = currentPreviewPreguntas.map(p => {
        return {
          id: p.id,
          enunciado: p.enunciado,
          topic: p.topic || '',
          ce: p.ce || null,
          criterio: p.criterio || 'N/A',
          opciones: p.opciones.map(o => ({ texto: o.texto })) 
        };
      });
      examenData.preguntas = preguntasSeguras;

      await addDoc(collection(db, "examenes_test"), examenData);
      showToast('Éxito', 'Examen guardado como borrador (oculto).', 'success');
      
      modalExam.classList.remove('modal-backdrop--visible');
      await loadExamsTab();
    } catch (e) {
      console.error(e);
      showToast('Error', 'Error al crear examen', 'error');
    } finally {
      hideLoading();
    }
  });

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

// ══════════════════════════════════════════════════════════════
//  TAB: EXÁMENES Y GENERADOR
// ══════════════════════════════════════════════════════════════

let currentPreviewPreguntas = [];
let unsubscribeExams = null;

async function loadExamsTab() {
  const tbody = $('examenes-test-list');
  if (!tbody) return;

  const q = query(collection(db, "examenes_test"), where("claseId", "==", classData.id));
  
  if(unsubscribeExams) unsubscribeExams();
  
  unsubscribeExams = onSnapshot(q, (snap) => {
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">No hay exámenes test para esta clase.</td></tr>';
      return;
    }
    
    let html = '';
    snap.forEach(docSnap => {
      const d = docSnap.data();
      let stateBadge = '';
      if(d.estado === 'activo') stateBadge = '<span class="badge badge--success">Activo (En curso)</span>';
      else if(d.estado === 'cerrado') stateBadge = '<span class="badge badge--muted">Cerrado</span>';
      else if(d.estado === 'oculto') stateBadge = '<span class="badge badge--warning">Oculto (Borrador)</span>';
      else stateBadge = `<span class="badge badge--warning">${d.estado}</span>`;
                        
      const dateStr = d.creadoEn ? d.creadoEn.toDate().toLocaleString('es-ES') : 'Recién creado';
      
      html += `
        <tr>
          <td><strong>${escapeHtml(d.titulo)}</strong></td>
          <td>${d.preguntas ? d.preguntas.length : 0} <span class="text-muted" style="font-size:0.8em">preguntas</span></td>
          <td>${d.tiempoMinutos} <span class="text-muted" style="font-size:0.8em">min</span></td>
          <td>${stateBadge}</td>
          <td style="font-size:0.8em; color:var(--text-muted);">${dateStr}</td>
          <td style="text-align: right; display:flex; gap:4px; justify-content:flex-end;">
            <a href="examen_resultados.html?id=${docSnap.id}" class="btn btn-ghost btn--sm" title="Ver Resultados / Configurar">⚙️</a>
            <button class="btn btn-ghost btn--sm" style="color:var(--error);" onclick="window._deleteExamenTest('${docSnap.id}')" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  });
}

window._activarExamenTest = async (id) => {
  showModal('Activar Examen', '¿Activar este examen? Los alumnos de la clase empezarán a verlo en su panel y el tiempo global empezará a contar desde este instante.', async () => {
    await updateDoc(doc(db, "examenes_test", id), { estado: 'activo', activadoEn: serverTimestamp() });
    showToast('Examen activado', 'Visible para los alumnos', 'success');
  });
};

window._cerrarExamenTest = async (id) => {
  showModal('Cerrar Examen', '¿Cerrar el examen? Los alumnos no podrán entregar más respuestas.', async () => {
    await updateDoc(doc(db, "examenes_test", id), { estado: 'cerrado' });
    showToast('Examen cerrado', 'Ya no admite respuestas', 'info');
  });
};

window._deleteExamenTest = async (id) => {
  showModal('Eliminar Examen', '¿Eliminar examen por completo? Se borrarán todas las respuestas e intentos asociados.', async () => {
    try {
      const q = query(collection(db, "respuestas_test"), where("examenId", "==", id));
      const snap = await getDocs(q);
      
      const deletePromises = [];
      snap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, "respuestas_test", d.id)));
      });
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, "examenes_test", id));
      
      showToast('Examen eliminado', `Se eliminó el examen y ${snap.size} intentos`, 'success');
    } catch(e) {
      console.error(e);
      showToast('Error', 'No se pudo eliminar el examen', 'error');
    }
  });
};

// ══════════════════════════════════════════════════════════════
//  GAMIFICACION - RENDER PODIO Y GREMIOS
// ══════════════════════════════════════════════════════════════
function renderGamificationDashboard(membersList, classId) {
  window._lastMembers = membersList; // Guardar para el modal de medallas
  const podioContainer = $('podio-container');
  const gremiosContainer = $('gremios-container');
  
  if (!podioContainer || !gremiosContainer) return;

  const topAlumnos = [...membersList]
    .sort((a,b) => (b.puntosTotal || b.totalScore || 0) - (a.puntosTotal || a.totalScore || 0))
    .slice(0,5);

  if (topAlumnos.length === 0) {
    podioContainer.innerHTML = '<div class="text-muted" style="text-align:center;">No hay alumnos.</div>';
  } else {
    podioContainer.innerHTML = topAlumnos.map((a, i) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border); border-radius: ${i===0?'8px 8px 0 0':''}; background: ${i===0?'#fff9c4': i===1?'#f5f5f5': i===2?'#ffe0b2':'transparent'};">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem; font-weight: bold; width: 30px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1)+'.'}</span>
          <div>
            <div style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(a.displayNameAnonymized || a.displayName || a.name || a.email?.split('@')[0] || 'Alumno')}</div>
            <div style="font-size: 0.8rem; color: #7f8c8d;">${escapeHtml((a.gremios?.[classId] || a.gremio) || 'Sin gremio')}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="background: #f1c40f; color: #fff; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 0.9rem;">⭐ ${a.puntosTotal || a.totalScore || 0} pts</span>
        </div>
      </div>
    `).join('');
  }

  const scores = {};
  const counts = {};
  GUILDS_CATALOG.forEach(g => { counts[g.name] = 0; scores[g.name] = 0; });

  membersList.forEach(m => {
    const pts = m.puntosTotal || m.totalScore || 0;
    const gremioActual = m.gremios?.[classId] || m.gremio;
    if (gremioActual && counts[gremioActual] !== undefined) {
      counts[gremioActual]++;
      scores[gremioActual] += pts;
    }
  });

  const ranking = GUILDS_CATALOG.map(g => ({
    name: g.name, icon: g.icon, color: g.color, image: g.image,
    points: scores[g.name], members: counts[g.name]
  })).sort((a,b) => b.points - a.points);
  
  if (ranking.every(r => r.members === 0)) {
    gremiosContainer.innerHTML = '<div class="text-muted" style="text-align:center;">Ningún alumno tiene gremio asignado.</div>';
    return;
  }
  
  gremiosContainer.style.display = 'flex';
  gremiosContainer.style.flexDirection = 'column';
  gremiosContainer.style.gap = 'var(--space-4)';
  gremiosContainer.style.padding = '0';
  
  gremiosContainer.innerHTML = ranking.map((g, idx) => {
    const isFirst = idx === 0;
    const isSecond = idx === 1;
    const isThird = idx === 2;
    let badge = '';
    let scale = '1';
    let border = g.color;
    let bg = 'var(--bg-card)';
    
    // Buscar al MVP de este gremio
    const guildMembers = membersList.filter(m => (m.gremios?.[classId] || m.gremio) === g.name).sort((a,b) => (b.puntosTotal||b.totalScore||0) - (a.puntosTotal||a.totalScore||0));
    const mvp = guildMembers.length > 0 ? guildMembers[0] : null;
    let mvpHtml = '';
    if (mvp && (mvp.puntosTotal||mvp.totalScore||0) > 0) {
      const mvpPts = mvp.puntosTotal||mvp.totalScore||0;
      mvpHtml = `<div style="margin-top:12px; background:rgba(0,0,0,0.05); border-radius:8px; padding:8px 12px; display:inline-block; border-left:3px solid ${g.color};">
        <span style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); font-weight:bold;">👑 MVP:</span> 
        <span style="font-weight:bold; color:var(--text-primary); margin-left:5px;">${escapeHtml(mvp.displayNameAnonymized || mvp.displayName || mvp.email?.split('@')[0])}</span> 
        <span style="color:var(--warning); font-weight:bold; font-size:0.9rem;">(⭐ ${mvpPts})</span>
      </div>`;
    }

    // Calcular distancia con el anterior
    let distanceHtml = '';
    if (idx > 0 && ranking[idx-1].points > 0) {
      const diff = ranking[idx-1].points - g.points;
      if (diff > 0) {
        distanceHtml = `<div style="color:var(--error); font-size:0.85rem; font-weight:bold; margin-top:5px; text-transform:uppercase; background:#ffeaa7; padding:4px 8px; border-radius:4px; border:1px solid #fdcb6e; display:inline-block;">
          🔥 ¡A solo ${diff} XP de subir!
        </div>`;
      }
    }
    
    if (isFirst) { badge = '🥇 LÍDERES ABSOLUTOS'; scale = '1.02'; border = '#f1c40f'; bg = '#fffdf5'; }
    else if (isSecond) { badge = '🥈 SEGUNDO PUESTO'; scale = '1.0'; border = '#bdc3c7'; bg = '#f8f9fa'; }
    else if (isThird) { badge = '🥉 TERCER PUESTO'; scale = '0.98'; border = '#cd6133'; bg = '#fdfbf7'; }
    else { badge = `${idx+1}º Puesto`; scale = '0.95'; border = 'var(--border)'; bg = 'var(--bg-card)'; }
    
    return `
      <div class="card" style="display:flex; align-items:center; gap:var(--space-4); padding:var(--space-4); background:${bg}; border:4px solid ${border}; transform:scale(${scale}); transform-origin:center; position:relative; overflow:hidden; box-shadow:6px 6px 0px rgba(0,0,0,${isFirst ? '0.2' : '0.1'}); margin: 10px 0;">
        ${isFirst ? `<div style="position:absolute; top:-10px; right:-10px; font-size:7rem; opacity:0.1; transform:rotate(-15deg);">${g.icon}</div>` : ''}
        
        <div style="width:70px; height:70px; border-radius:50%; background-color:${g.color}; display:flex; align-items:center; justify-content:center; border:4px solid var(--text-primary); box-shadow:4px 4px 0px rgba(0,0,0,1); flex-shrink:0;">
          <img src="${g.image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
        </div>
        
        <div style="flex:1;">
          <div style="font-size:0.8rem; font-weight:bold; color:${isFirst ? '#d35400' : 'var(--text-muted)'}; margin-bottom:2px; text-transform:uppercase; letter-spacing:2px;">${badge}</div>
          <h3 style="margin:0; font-size:1.4rem; color:${g.color}; text-shadow:1px 1px 0px var(--text-primary); -webkit-text-stroke: 1px var(--text-primary); line-height: 1.1;">${escapeHtml(g.name)}</h3>
          <div style="margin-top:5px; font-size:0.95rem; color:var(--text-primary); font-weight:bold;">
            👥 ${g.members} valientes
          </div>
          ${mvpHtml}
        </div>
        
        <div style="text-align:right; z-index:2; background:rgba(255,255,255,0.7); padding:8px 15px; border-radius:10px; border:2px solid var(--text-primary); box-shadow:3px 3px 0px rgba(0,0,0,1); display:flex; flex-direction:column; align-items:flex-end;">
          <div style="font-size:0.75rem; font-weight:bold; color:var(--text-primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Puntos Totales</div>
          <div style="font-size:1.8rem; font-weight:900; color:var(--warning); text-shadow:1px 1px 0px var(--text-primary), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; line-height:1;">
            ⭐ ${g.points.toLocaleString()}
          </div>
          ${distanceHtml}
        </div>
      </div>
    `;
  }).join('');
}

window._showMedallas = function(uidStr) {
  const membersList = members || window._lastMembers || [];
  const alumno = membersList.find(m => m.uid === uidStr || m.email === uidStr || m.id === uidStr);
  if (!alumno) return;

  $('medallas-alumno-nombre').textContent = alumno.displayNameAnonymized || alumno.displayName || alumno.name || alumno.email?.split('@')[0] || 'Alumno';
  const container = $('medallas-alumno-list');

  const logros = alumno.logros || [];
  
  container.innerHTML = MEDALS_CATALOG.map(cat => {
    const isUnlocked = logros.some(l => l.id === cat.id);
    const isHidden = !cat.public && !isUnlocked;
    
    const displayIcon = isHidden ? '❓' : (cat.icon || '🏅');
    const displayName = isHidden ? 'Logro Oculto' : cat.name;
    const displayDesc = isHidden ? 'Descubre cómo desbloquearlo jugando...' : cat.desc;

    return `
      <div style="display:flex; align-items:center; gap: 15px; background:${isUnlocked ? '#fff' : '#f9f9f9'}; padding: 10px; border-radius: 8px; border-left: 4px solid ${isUnlocked ? '#f1c40f' : '#bdc3c7'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); opacity: ${isUnlocked ? '1' : '0.6'}; transition: all 0.2s;">
        <div style="font-size: 2.5rem; filter: ${isUnlocked ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))' : 'grayscale(100%)'};">${displayIcon}</div>
        <div>
          <div style="font-weight: bold; font-size: 1.1rem; color: ${isUnlocked ? '#2c3e50' : '#7f8c8d'};">${escapeHtml(displayName)}</div>
          <div style="font-size: 0.9rem; color: #7f8c8d;">${escapeHtml(displayDesc || '')}</div>
        </div>
      </div>
    `;
  }).join('');
  
  $('modal-medallas').classList.add('modal-backdrop--visible');
}


// ══════════════════════════════════════════════════════════════
//  TESTS DE TEORÍA
// ══════════════════════════════════════════════════════════════
async function loadTheoryTab() {
  const tbody = $('theory-results-list');
  if (!tbody) return;

  try {
    if (!members || members.length === 0) {
      // Intentar cargar por si el profe ha entrado directo a esta pestaña sin pasar por Alumnos
      members = await getClassMembers(classData.id);
    }
    if (!members || members.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay alumnos en esta clase.</td></tr>';
      return;
    }
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando resultados... <i class="fas fa-spinner fa-spin"></i></td></tr>';

    // Batch fetch in chunks of 10
    const studentIds = members.map(m => m.uid || m.id);
    let allResults = [];
    
    for (let i = 0; i < studentIds.length; i += 10) {
      const chunk = studentIds.slice(i, i + 10);
      const q = query(collection(db, "tic2_tests_teoria"), where("uid", "in", chunk));
      const snap = await getDocs(q);
      snap.forEach(d => {
        allResults.push({ id: d.id, ...d.data() });
      });
    }

    // Agrupar por alumno y tema, quedarse con el último intento
    let grouped = {};
    allResults.forEach(r => {
      const key = `${r.uid}_${r.topicKey}`;
      if (!grouped[key]) {
        grouped[key] = { ...r, attempts: 1 };
      } else {
        grouped[key].attempts += 1;
        const timeCurrent = grouped[key].fecha && grouped[key].fecha.toMillis ? grouped[key].fecha.toMillis() : 0;
        const timeNew = r.fecha && r.fecha.toMillis ? r.fecha.toMillis() : 0;
        if (timeNew > timeCurrent) {
           const attempts = grouped[key].attempts;
           grouped[key] = { ...r, attempts };
        }
      }
    });
    
    let finalResults = Object.values(grouped);

    finalResults.sort((a, b) => {
      const timeA = a.fecha && a.fecha.toMillis ? a.fecha.toMillis() : 0;
      const timeB = b.fecha && b.fecha.toMillis ? b.fecha.toMillis() : 0;
      return timeB - timeA;
    });

    if (finalResults.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aún no se ha realizado ningún test de teoría.</td></tr>';
      return;
    }

    tbody.innerHTML = finalResults.map(r => {
      let fDate = "Desconocida";
      if (r.fecha && r.fecha.toDate) {
        fDate = r.fecha.toDate().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      }
      const isPassed = r.score >= 5;
      const isGold = r.score >= 9;
      
      return `
        <tr>
          <td style="font-weight:bold;">
            ${escapeHtml(r.alumnoNombre || 'Desconocido')}
            ${r.attempts > 1 ? `<br><span class="badge" style="background:#e74c3c; font-size:0.7em; margin-top:4px;">${r.attempts} intentos</span>` : ''}
          </td>
          <td><span class="badge badge--primary">${escapeHtml(r.topicTitle || r.topicKey)}</span></td>
          <td style="font-size:0.85em; color:var(--text-muted);">${fDate}</td>
          <td>
            <span style="font-size: 1.2rem; font-weight: bold; color: ${isPassed ? 'var(--success)' : 'var(--danger)'};">
              ${r.score.toFixed(2)}
            </span>
            ${isGold ? ' <span title="Sobresaliente">🥇</span>' : ''}
            ${!isPassed ? ' <span title="Suspenso">💀</span>' : ''}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar los resultados.</td></tr>';
  }
}

if ($('btn-refresh-theory')) {
  $('btn-refresh-theory').addEventListener('click', loadTheoryTab);
}

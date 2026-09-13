// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — dashboard_teacher.js
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, updateUserProfileData } from './common/auth.js';
import { getTeacherClasses, createClass, getClassMembers, getClassResults, getStudentResults, addStudentsToClass } from './common/db.js';
import { fetchClassroomCourses, importClassroomStudents } from './common/classroom.js';
import { renderHeader, showToast, showModal, showLoading, hideLoading } from './common/ui.js';
import { TOPICS, GAMES, copyToClipboard, $, escapeHtml, formatDate, getUrlParams } from './common/utils.js';

let myClasses = [];

// ── Guard de autenticación ──────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    $('teacher-welcome').textContent = `Hola, ${profile.displayName || 'Docente'} 👋`;
    await loadAll(user, profile);
    setupModals();
    renderTeacherGameCards();
    renderTeacherTopicCards();
    await loadTeacherHistory(user.uid);
  }
});

// ── Carga principal ─────────────────────────────────────────────
async function loadAll(user, profile) {
  try {
    myClasses = await getTeacherClasses(user.uid);
    renderClasses(myClasses);
    updateStats(myClasses);
  } catch (err) {
    console.error('Error cargando clases:', err);
    showToast('Error', 'No se pudieron cargar las clases.', 'error');
  }
}

// ── Renderizar lista de clases ──────────────────────────────────
function renderClasses(classes) {
  const list  = $('classes-list');
  const empty = $('empty-classes');
  if (!list) return;

  if (classes.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = classes.map(cls => renderClassCard(cls)).join('');

  // Eventos en las tarjetas
  list.querySelectorAll('[data-action="manage"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `class_detail.html?classId=${btn.dataset.classId}`;
    });
  });
  list.querySelectorAll('[data-action="copy-pin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await copyToClipboard(btn.dataset.pin);
      showToast('PIN copiado', `PIN ${btn.dataset.pin} copiado al portapapeles`, 'success', 2000);
    });
  });
}

function renderClassCard(cls) {
  const enabledGames = cls.enabledGames || [];
  
  return `
    <div class="class-card">
      <div class="class-card-header">
        <h3 class="class-card-name">${escapeHtml(cls.name)}</h3>
        <button class="class-card-pin" data-action="copy-pin" data-pin="${cls.pin}"
                title="Copiar PIN">
          📋 ${cls.pin}
        </button>
      </div>
      <div class="class-card-meta">
        <span>👨‍🎓 ${(cls.members || []).length} alumnos</span>
        <span>🎮 ${enabledGames.length} juegos activos</span>
      </div>
      <div class="class-card-actions">
        <button class="btn btn-primary btn--sm" data-action="manage" data-class-id="${cls.id}">
          ⚙️ Gestionar clase
        </button>
      </div>
    </div>`;
}

// ── Stats ───────────────────────────────────────────────────────
async function updateStats(classes) {
  let totalStudents = 0;
  let totalGamesEnabled = 0;

  for (const cls of classes) {
    totalStudents    += (cls.members || []).length;
    totalGamesEnabled += (cls.enabledGames || []).length;
  }

  $('stat-classes').textContent  = classes.length;
  $('stat-students').textContent = totalStudents;
  $('stat-games').textContent    = totalGamesEnabled;
  $('stat-results').textContent  = '—'; // Se podría añadir query de game_results
}

// ── Tarjetas de juego para el docente ──────────────────────────
function renderTeacherGameCards() {
  const grid = $('teacher-games-grid');
  if (!grid) return;
  grid.innerHTML = Object.values(GAMES).map(g => `
    <a class="game-card" href="${g.gamePath}" style="--game-color:${g.color}; --game-color-dark:${g.colorDark}; text-decoration: none;">
      <div class="game-card-link" style="pointer-events: none;">
        <div class="game-card-icon">${g.icon}</div>
        <div class="game-card-name">${escapeHtml(g.name)}</div>
        <div class="game-card-desc">${escapeHtml(g.description)}</div>
      </div>
    </a>`).join('');
}

// ── Tarjetas de Temario para el docente ──────────────────────────
function renderTeacherTopicCards() {
  const grid = $('teacher-topics-grid');
  if (!grid) return;
  grid.innerHTML = Object.values(TOPICS).map(t => `
    <a class="game-card" href="${t.htmlPath || t.pdfPath}" target="_blank" style="--game-color:${t.color}; --game-color-dark:${t.colorDark}; text-decoration: none;">
      <div class="game-card-link" style="pointer-events: none;">
        <div class="game-card-icon">${t.icon}</div>
        <div class="game-card-name">${escapeHtml(t.name)}</div>
        <div class="game-card-desc">${escapeHtml(t.description || 'Ver temario')}</div>
      </div>
    </a>`).join('');
}

// ── Historial de partidas del Docente ──────────────────────────
async function loadTeacherHistory(uid) {
  try {
    const results = await getStudentResults(uid, 10);
    const tbody = $('teacher-history-list');
    if (!tbody) return;
    
    if (results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: var(--space-6);">Aún no has jugado ninguna partida.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = results.map(r => {
      const gameInfo = Object.values(GAMES).find(g => g.id === r.gameId) || { name: r.gameId, icon: '🎮' };
      const dateStr = formatDate(r.timestamp);
      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <span>${gameInfo.icon}</span>
              <strong>${escapeHtml(gameInfo.name)}</strong>
            </div>
          </td>
          <td style="font-family: var(--font-mono); font-weight: bold; color: var(--accent-light);">
            ${r.score} pts
          </td>
          <td style="color: var(--text-muted); font-size: var(--text-xs);">
            ${dateStr}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando historial del docente:', err);
  }
}

// ── Modales ─────────────────────────────────────────────────────
function setupModals() {

  // ─ Modal nueva clase ─
  const modalNewClass  = $('modal-new-class');
  const formNewClass   = $('form-new-class');
  const openNewClass   = $('btn-new-class');
  const closeNewClass  = $('close-new-class');
  const cancelNewClass = $('cancel-new-class');

  openNewClass?.addEventListener('click', () => {
    $('class-name-input').value = '';
    const stInput = $('class-students-input');
    if (stInput) stInput.value = '';
    modalNewClass.classList.add('modal-backdrop--visible');
    modalNewClass.setAttribute('aria-hidden', 'false');
  });
  const closeModalNew = () => {
    modalNewClass.classList.remove('modal-backdrop--visible');
    modalNewClass.setAttribute('aria-hidden', 'true');
  };
  closeNewClass?.addEventListener('click', closeModalNew);
  cancelNewClass?.addEventListener('click', closeModalNew);
  modalNewClass?.addEventListener('click', e => { if (e.target === modalNewClass) closeModalNew(); });

  formNewClass?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('class-name-input').value.trim();
    if (!name) return;
    const level = parseInt($('class-level-input')?.value || '1');
    const studentsRaw = $('class-students-input')?.value || '';

    try {
      showLoading('Creando clase...');
      const cls = await createClass(currentUser.uid, name, level);
      
      let addedInfo = '';
      if (studentsRaw.trim()) {
        const studentResult = await addStudentsToClass(cls.id, studentsRaw);
        if (studentResult.added > 0) {
          addedInfo = ` (${studentResult.added} alumnos añadidos)`;
        }
      }

      closeModalNew();
      showToast('Clase creada', `PIN: ${cls.pin}${addedInfo} — ya puedes compartirlo con tus alumnos.`, 'success', 5000);
      
      myClasses = await getTeacherClasses(currentUser.uid);
      renderClasses(myClasses);
      updateStats(myClasses);
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // ─ Modal importar Classroom ─
  const modalImport  = $('modal-import-classroom');
  const btnImport    = $('btn-import-classroom');
  const closeImport  = $('close-import-classroom');

  btnImport?.addEventListener('click', async () => {
    modalImport.classList.add('modal-backdrop--visible');
    modalImport.setAttribute('aria-hidden', 'false');
    await loadClassroomCourses();
  });
  const closeModalImport = () => {
    modalImport.classList.remove('modal-backdrop--visible');
    modalImport.setAttribute('aria-hidden', 'true');
  };
  closeImport?.addEventListener('click', closeModalImport);
  modalImport?.addEventListener('click', e => { if (e.target === modalImport) closeModalImport(); });

  // ─ Modal editar nombre ─

}

// ── Importación desde Classroom ─────────────────────────────────
async function loadClassroomCourses() {
  const body = $('classroom-modal-body');
  if (!body) return;

  let token = classroomToken;

  if (!token) {
    body.innerHTML = `
      <div class="alert alert--warning" style="margin-bottom:var(--space-4)">
        <span>⚠️</span>
        <div>No hay token de Classroom activo. Debes haber iniciado sesión como <strong>Docente con Google</strong>.</div>
      </div>
      <button class="btn btn-primary btn--full" id="btn-reauth-classroom">
        🔑 Autorizar acceso a Classroom
      </button>`;

    $('btn-reauth-classroom')?.addEventListener('click', async () => {
      try {
        token = await refreshClassroomToken();
        await loadClassroomCourses();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
    return;
  }

  body.innerHTML = `<div class="loading-content" style="padding:var(--space-8) 0">
    <div class="spinner"></div><p>Cargando cursos...</p></div>`;

  try {
    const courses = await fetchClassroomCourses(token);

    if (courses.length === 0) {
      body.innerHTML = '<p class="empty-state">No se encontraron cursos activos en Classroom.</p>';
      return;
    }

    body.innerHTML = `
      <p style="margin-bottom:var(--space-4); color:var(--text-secondary); font-size:var(--text-sm)">
        Selecciona los cursos que quieres importar. Se creará una clase en ClassHub por cada curso.
      </p>
      <div class="classroom-courses-list">
        ${courses.map(c => `
          <label class="classroom-course-item">
            <input type="checkbox" name="course" value="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">
            <div class="course-info">
              <strong>${escapeHtml(c.name)}</strong>
              <small>${escapeHtml(c.section || c.descriptionHeading || '')}</small>
            </div>
          </label>`).join('')}
      </div>
      <div style="margin-top:var(--space-5)">
        <button class="btn btn-primary btn--full" id="btn-do-import">
          📥 Importar seleccionados
        </button>
      </div>`;

    $('btn-do-import')?.addEventListener('click', () => doImportClassroom(token));

  } catch (err) {
    if (err.code === 'CLASSROOM_TOKEN_EXPIRED') {
      token = null;
      await loadClassroomCourses();
    } else {
      body.innerHTML = `<div class="alert alert--error">${escapeHtml(err.message)}</div>`;
    }
  }
}

async function doImportClassroom(token) {
  const checked = document.querySelectorAll('input[name="course"]:checked');
  if (checked.length === 0) {
    showToast('Selecciona al menos un curso', '', 'warning');
    return;
  }

  try {
    showLoading('Importando clases y alumnos...');
    let imported = 0;

    for (const cb of checked) {
      const courseId = cb.value;
      const name     = cb.dataset.name;

      showLoading('Importando curso y alumnos...');
      // 1. Crear clase en Firestore
      const cls = await createClass(currentUser.uid, name, 1, { classroomCourseId: courseId });
      
      // 2. Traer alumnos de Classroom
      const { matched, pending } = await importClassroomStudents(token, courseId, cls.id);
      imported++;
      showToast(`Clase "${name}" importada`, `${matched} alumnos vinculados, ${pending} pendientes de registro.`, 'success', 4000);
    }

    $('modal-import-classroom').setAttribute('aria-hidden', 'true');
    myClasses = await getTeacherClasses(currentUser.uid);
    renderClasses(myClasses);
    updateStats(myClasses);

  } catch (err) {
    showToast('Error en importación', err.message, 'error');
  } finally {
    hideLoading();
  }
}

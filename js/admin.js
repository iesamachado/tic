// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — admin.js (Panel de Administración)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, SUPERADMIN_EMAIL } from './common/auth.js';
import { getAllowedTeachers, authorizeTeacher, removeAllowedTeacher } from './common/db.js';
import { renderHeader, showToast, showLoading, hideLoading, showModal } from './common/ui.js';
import { $, $$, escapeHtml, formatDate } from './common/utils.js';

let teacherList = [];
let searchQuery = '';

// ── Guard de Administrador ──────────────────────────────────────────
requireAuth({
  allowedRoles: ['admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    setupEvents(user);
    await loadTeachers();
  }
});

// ── Carga de Docentes ───────────────────────────────────────────────
async function loadTeachers() {
  try {
    showLoading('Cargando docentes autorizados...');
    const list = await getAllowedTeachers();

    // Asegurar que el superadmin aparezca si aún no está en Firestore
    const hasSuperAdmin = list.some(t => t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase());
    if (!hasSuperAdmin) {
      list.unshift({
        id: SUPERADMIN_EMAIL.toLowerCase(),
        email: SUPERADMIN_EMAIL.toLowerCase(),
        name: 'Superadministrador Principal',
        role: 'admin',
        isSuperAdmin: true,
        createdAt: null,
        addedBy: 'Sistema'
      });
    }

    teacherList = list;
    updateStats(teacherList);
    renderTeacherList();
  } catch (err) {
    console.error('Error cargando docentes autorizados:', err);
    showToast('Error', 'No se pudieron cargar los docentes autorizados.', 'error');
  } finally {
    hideLoading();
  }
}

// ── Actualizar Estadísticas ─────────────────────────────────────────
function updateStats(list) {
  const total = list.length;
  const admins = list.filter(t => t.role === 'admin' || t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()).length;
  
  const domains = new Set(
    list.map(t => {
      const parts = t.email.split('@');
      return parts[1] || '';
    }).filter(Boolean)
  );

  $('stat-total-teachers').textContent = total;
  $('stat-admins').textContent = admins;
  $('stat-domains').textContent = domains.size;
  $('teachers-count-subtitle').textContent = `${total} usuario(s) registrado(s)`;
}

// ── Renderizado de la Lista ─────────────────────────────────────────
function renderTeacherList() {
  const container = $('teachers-list-container');
  const emptyMsg  = $('empty-teachers-msg');
  if (!container) return;

  const query = searchQuery.trim().toLowerCase();
  const filtered = teacherList.filter(t => {
    if (!query) return true;
    const matchEmail = (t.email || '').toLowerCase().includes(query);
    const matchName  = (t.name || '').toLowerCase().includes(query);
    const matchRole  = (t.role || '').toLowerCase().includes(query);
    return matchEmail || matchName || matchRole;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  container.innerHTML = filtered.map(t => {
    const isSuperAdmin = t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
    const isAdminRole = t.role === 'admin' || isSuperAdmin;
    const roleBadge = isAdminRole
      ? `<span class="badge" style="background:#ffc300; color:#000; font-weight:800; border:1px solid #000;">👑 Admin</span>`
      : `<span class="badge badge--accent" style="font-weight:700;">👨‍🏫 Docente</span>`;

    const dateStr = t.createdAt ? formatDate(t.createdAt) : 'Creador inicial';
    const addedByStr = t.addedBy ? `Por: ${escapeHtml(t.addedBy)}` : '';

    return `
      <div class="teacher-item-row" id="teacher-row-${escapeHtml(t.id)}">
        <div class="teacher-item-info">
          <div class="teacher-item-avatar">
            ${isAdminRole ? '👑' : '👨‍🏫'}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap;">
              <strong style="font-size:var(--text-base); color:var(--text-primary);">${escapeHtml(t.email)}</strong>
              ${roleBadge}
            </div>
            <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">
              ${t.name ? `<span>${escapeHtml(t.name)}</span> · ` : ''}
              <span>${dateStr}</span>
              ${addedByStr ? ` · <span>${addedByStr}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="teacher-item-actions">
          ${isSuperAdmin ? `
            <span class="badge" style="background:var(--bg-body); border:1px solid var(--border); color:var(--text-muted);">
              🔒 Superadmin Principal
            </span>
          ` : `
            <button class="btn btn-outline btn--sm" data-action="toggle-role" data-email="${escapeHtml(t.email)}" data-current-role="${t.role || 'teacher'}">
              ${isAdminRole ? 'Convertir en Docente' : 'Hacer Admin'}
            </button>
            <button class="btn btn-ghost btn--sm" data-action="remove" data-email="${escapeHtml(t.email)}" style="color:var(--error); padding:6px 10px;" title="Revocar autorización">
              🗑️ Revocar
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners en botones de acción
  container.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const current = btn.dataset.currentRole;
      const newRole = current === 'admin' ? 'teacher' : 'admin';
      const roleName = newRole === 'admin' ? 'Administrador' : 'Docente';

      showModal('Cambiar Rol', `¿Cambiar el rol de ${email} a "${roleName}"?`, async () => {
        try {
          showLoading('Actualizando rol...');
          await authorizeTeacher(email, { role: newRole, addedBy: currentUser.email });
          showToast('Rol actualizado', `${email} ahora es ${roleName}.`, 'success');
          await loadTeachers();
        } catch (err) {
          showToast('Error', err.message, 'error');
        } finally {
          hideLoading();
        }
      });
    });
  });

  container.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      showModal('Revocar Acceso', `¿Revocar el acceso docente a ${email}? Ya no podrá iniciar sesión como profesor.`, async () => {
        try {
          showLoading('Revocando acceso...');
          await removeAllowedTeacher(email);
          showToast('Acceso revocado', `${email} ha sido eliminado de la lista de docentes autorizados.`, 'info');
          await loadTeachers();
        } catch (err) {
          showToast('Error', err.message, 'error');
        } finally {
          hideLoading();
        }
      });
    });
  });
}

// ── Eventos de la Interfaz ──────────────────────────────────────────
function setupEvents(user) {
  // Buscador
  const searchInput = $('input-search-teacher');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderTeacherList();
    });
  }

  // Formulario para autorizar nuevo docente o lote de docentes
  const form = $('form-add-teacher');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const inputEmails = $('input-teacher-emails');
      const inputName = $('input-teacher-name');
      const selectRole = $('select-teacher-role');

      const rawEmails = inputEmails ? inputEmails.value : '';
      const nameNote  = inputName ? inputName.value.trim() : '';
      const role      = selectRole ? selectRole.value : 'teacher';

    const emails = rawEmails
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      showToast('Atención', 'Introduce al menos un correo electrónico válido.', 'warning');
      return;
    }

    try {
      showLoading(`Autorizando ${emails.length} docente(s)...`);
      let successCount = 0;

      for (const email of emails) {
        await authorizeTeacher(email, {
          name: nameNote || undefined,
          role: role,
          addedBy: user.email || 'Admin'
        });
        successCount++;
      }

      form.reset();
      showToast('Docente(s) autorizados', `Se concedió acceso a ${successCount} cuenta(s).`, 'success', 4000);
      await loadTeachers();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
    });
  }
}

// ── Herramientas de Mantenimiento ──────────────────────────────────────
const btnRecalc = document.getElementById('btn-recalc-xp');
if (btnRecalc) {
  btnRecalc.addEventListener('click', () => {
    showModal({
      title: '⚠️ Recalcular XP Global',
      body: `Esta acción recalculará la XP de todos los alumnos aplicando la nueva regla anti-farmeo (Récord + 2 XP por repetición).<br><br><b>Afectará a los gremios y ligas de forma irreversible.</b><br>¿Estás completamente seguro?`,
      dangerous: true,
      confirmText: 'Sí, desinflar XP',
      onConfirm: async () => {
        try {
          showLoading('Recalculando toda la base de datos... Por favor, espera.');
          
          const firestore = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
          const { db } = await import('./common/db.js');
          const { collection, getDocs, doc, setDoc, writeBatch, query, where } = firestore;

          const usersSnap = await getDocs(collection(db, 'tic2_users'));
          const users = usersSnap.docs;

          const batch = writeBatch(db);
          let count = 0;
          let guildSums = {};

          for (const userDoc of users) {
            const uid = userDoc.id;
            const data = userDoc.data();
            let correctXP = 0;

            const examsSnap = await getDocs(query(collection(db, 'respuestas_test'), where('uid', '==', uid), where('puntosOtorgados', '==', true)));
            examsSnap.forEach(d => {
              const e = d.data();
              let xp = (e.aciertos || 0) * 10;
              if (e.nota >= 5) xp += 100;
              if (e.nota >= 9) xp += 200;
              correctXP += xp;
            });

            const gamesSnap = await getDocs(query(collection(db, 'tic2_game_results'), where('studentId', '==', uid)));
            const gameGroups = {};
            gamesSnap.forEach(d => {
              const g = d.data();
              const key = `${g.gameId}_${g.classId || 'free'}`;
              if (!gameGroups[key]) gameGroups[key] = { best: 0, plays: 0 };
              if (g.score > gameGroups[key].best) gameGroups[key].best = g.score;
              gameGroups[key].plays += 1;
            });

            for (const key in gameGroups) {
              const info = gameGroups[key];
              correctXP += info.best + (info.plays * 2);
            }

            if (correctXP !== (data.puntosTotal || 0)) {
              batch.set(userDoc.ref, { puntosTotal: correctXP }, { merge: true });
              count++;
            }
            if (data.gremio) guildSums[data.gremio] = (guildSums[data.gremio] || 0) + correctXP;
          }

          for (const [guildId, points] of Object.entries(guildSums)) {
            batch.set(doc(db, 'gremios', guildId), { puntosTotales: points }, { merge: true });
          }

          if (count > 0) await batch.commit();
          
          hideLoading();
          showToast(`✅ Proceso completado. Se han purgado ${count} usuarios y ajustado sus Gremios.`, 'success');
        } catch (err) {
          console.error(err);
          hideLoading();
          showToast('❌ Error durante el recálculo: ' + err.message, 'error');
        }
      }
    });
  });
}

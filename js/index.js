// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — index.js (Página de login)
// ═══════════════════════════════════════════════════════════════════════

import {
  loginWithGoogle, loginAsTeacher,
  loginWithEmail, registerWithEmail,
  resetPassword, setupAuthListener
} from './common/auth.js';
import { initParticles, showToast } from './common/ui.js';
import { $ } from './common/utils.js';

// Inicializar partículas de fondo
initParticles('particles-canvas');

// ── Si ya hay sesión activa, redirigir ─────────────────────────
setupAuthListener((user, profile) => {
  if (!user || !profile) return; // No autenticado, mostrar login

  // Verificar si hay una URL guardada para redirigir (ej: venía de un juego)
  const redirect = sessionStorage.getItem('classhub_redirect');
  sessionStorage.removeItem('classhub_redirect');

  if (redirect && !redirect.includes('index.html')) {
    window.location.href = redirect;
    return;
  }

  // Redirigir al dashboard según rol
  if (profile.role === 'teacher' || profile.role === 'admin') {
    window.location.href = './dashboard_teacher.html';
  } else {
    window.location.href = './dashboard_student.html';
  }
});

// ── Botón DOCENTE (Google + Classroom) ─────────────────────────
$('btn-teacher-google')?.addEventListener('click', async () => {
  try {
    setLoading(true);
    showError('');
    await loginAsTeacher();
    // El listener de arriba hará el redirect
  } catch (err) {
    showError(`Error al iniciar como docente: ${err.message}`);
    showToast('Acceso Denegado', err.message, 'error', 6000);
    setLoading(false);
  }
});

// ── Botón ALUMNO (Google) ───────────────────────────────────────
$('btn-student-google')?.addEventListener('click', async () => {
  try {
    setLoading(true);
    await loginWithGoogle();
    // El listener de arriba hará el redirect
  } catch (err) {
    showError(`Error al iniciar sesión: ${err.message}`);
    setLoading(false);
  }
});

// ── Helpers ─────────────────────────────────────────────────────
function showError(msg, isError = true) {
  const el = $('login-error');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--error)' : 'var(--success)';
}

function showRegError(msg) {
  const el = $('register-error');
  if (el) el.textContent = msg;
}

function setLoading(active) {
  const btns = document.querySelectorAll('button, input[type="submit"]');
  btns.forEach(b => { b.disabled = active; });
  if (!active) btns.forEach(b => { b.disabled = false; });
}

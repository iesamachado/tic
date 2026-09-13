// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — UI (Componentes de interfaz reutilizables)
// ═══════════════════════════════════════════════════════════════════════

import { logout, isAdmin } from './auth.js';
import { GAMES, escapeHtml, formatDate, timeAgo, $, getAppUrl } from './utils.js';

// ══════════════════════════════════════════════════════════════════
//  HEADER / NAVBAR
// ══════════════════════════════════════════════════════════════════

/**
 * Renderiza el header con avatar, nombre y botón de logout.
 * Busca el elemento con id="app-header" y lo rellena.
 */
export function renderHeader(user, profile) {
  const header = $('app-header');
  if (!header) return;

  if (!user || !profile) {
    header.innerHTML = `
      <nav class="navbar">
        <a class="navbar-brand" href="#">
          <span class="brand-icon">🎓</span>
          <span class="brand-name">TIC2Hub</span>
        </a>
      </nav>`;
    return;
  }

  const userIsAdmin = isAdmin(user, profile);
  const isTeacher   = profile.role === 'teacher' || userIsAdmin;
  const dashUrl     = isTeacher
    ? getAppUrl('dashboard_teacher.html')
    : getAppUrl('dashboard_student.html');
  const adminUrl    = getAppUrl('admin.html');
  const profileUrl  = getAppUrl('profile.html');

  const badgeIcon = userIsAdmin ? '👑' : isTeacher ? '👨‍🏫' : '👨‍🎓';
  const badgeText = userIsAdmin ? 'Admin' : isTeacher ? 'Docente' : 'Alumno';
  const badgeClass = userIsAdmin ? 'user-badge--admin' : isTeacher ? 'user-badge--teacher' : 'user-badge--student';

  header.innerHTML = `
    <nav class="navbar">
      <a class="navbar-brand" href="${dashUrl}">
        <span class="brand-icon">🎓</span>
        <span class="brand-name">TIC2Hub</span>
      </a>

      <div class="navbar-center" id="navbar-breadcrumb"></div>

      <div class="navbar-user">
        ${userIsAdmin ? `
          <a href="${adminUrl}" class="user-badge ${badgeClass}" title="Ir al Panel de Administración" style="text-decoration:none; cursor:pointer; transition:transform 0.15s ease;">
            ${badgeIcon}
            <span>${badgeText}</span>
          </a>
        ` : `
          <div class="user-badge ${badgeClass}">
            ${badgeIcon}
            <span>${badgeText}</span>
          </div>
        `}
        <div class="navbar-avatar-wrapper" id="user-menu-trigger">
          <img class="navbar-avatar" 
               src="${escapeHtml(profile.photoURL || '')}" 
               alt="${escapeHtml(profile.displayName || 'Usuario')}"
               onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(user.uid)}'">
          <span class="navbar-username">${escapeHtml((profile.displayName || 'Usuario').split(' ')[0])}</span>
          <span class="navbar-caret">▾</span>
        </div>

        <div class="user-dropdown" id="user-dropdown" aria-hidden="true">
          <div class="user-dropdown-info">
            <img src="${escapeHtml(profile.photoURL || '')}" alt="Avatar"
                 onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(user.uid)}'">
            <div>
              <strong>${escapeHtml(profile.displayName || 'Usuario')}</strong>
              <small>${escapeHtml(profile.email || '')}</small>
            </div>
          </div>
          <hr class="dropdown-divider">
          <a class="dropdown-item" href="${dashUrl}">🏠 Mi Dashboard</a>
          ${userIsAdmin ? `<a class="dropdown-item" href="${adminUrl}">⚙️ Panel de Administración</a>` : ''}
          <a class="dropdown-item" href="${profileUrl}">👤 Mi Perfil</a>
          <button class="dropdown-item dropdown-item--danger" id="btn-logout">🚪 Cerrar sesión</button>
        </div>
      </div>
    </nav>`;

  // Dropdown toggle
  const trigger  = $('user-menu-trigger');
  const dropdown = $('user-dropdown');
  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.getAttribute('aria-hidden') === 'false';
    dropdown.setAttribute('aria-hidden', open ? 'true' : 'false');
  });
  document.addEventListener('click', () => {
    dropdown?.setAttribute('aria-hidden', 'true');
  });

  // Logout
  $('btn-logout')?.addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await logout();
  });
}

/** Establece el breadcrumb de la navbar */
export function setNavBreadcrumb(html) {
  const el = $('navbar-breadcrumb');
  if (el) el.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════
//  TOASTS
// ══════════════════════════════════════════════════════════════════

let _toastContainer = null;
function getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.getElementById('toast-container');
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

export function showToast(title, message = '', type = 'info', duration = 3500) {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Cerrar">✕</button>`;

  container.appendChild(toast);
  // Animación entrada
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const close = () => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };
  toast.querySelector('.toast-close').addEventListener('click', close);
  setTimeout(close, duration);
}

// ══════════════════════════════════════════════════════════════════
//  MODAL GENÉRICO
// ══════════════════════════════════════════════════════════════════

export function showModal({ title, body, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, dangerous = false }) {
  // Eliminar modal previo si existe
  document.getElementById('tic2hub-modal')?.remove();

  const modal = document.createElement('div');
  modal.id    = 'tic2hub-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 id="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" id="modal-btn-cancel" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-btn-cancel2">${escapeHtml(cancelText)}</button>
        ${confirmText ? `<button class="btn ${dangerous ? 'btn-danger' : 'btn-primary'}" id="modal-btn-confirm">${escapeHtml(confirmText)}</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('modal-backdrop--visible'));

  const close = () => {
    modal.classList.remove('modal-backdrop--visible');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
  };

  modal.querySelector('#modal-btn-cancel')?.addEventListener('click', close);
  modal.querySelector('#modal-btn-cancel2')?.addEventListener('click', close);
  modal.querySelector('#modal-btn-confirm')?.addEventListener('click', () => {
    if (onConfirm) onConfirm();
    close();
  });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  return { close };
}

// ══════════════════════════════════════════════════════════════════
//  PANTALLA DE CARGA
// ══════════════════════════════════════════════════════════════════

export function showLoading(msg = 'Cargando…') {
  let overlay = $('tic2hub-loading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tic2hub-loading';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p>${escapeHtml(msg)}</p>
    </div>`;
  overlay.classList.add('loading-overlay--visible');
}

export function hideLoading() {
  const overlay = $('tic2hub-loading');
  overlay?.classList.remove('loading-overlay--visible');
}

// ══════════════════════════════════════════════════════════════════
//  TARJETAS DE JUEGO
// ══════════════════════════════════════════════════════════════════

/**
 * Devuelve el HTML de una tarjeta de juego.
 * @param {object} game        - Objeto GAMES[gameId]
 * @param {boolean} enabled    - Si el juego está habilitado en la clase
 * @param {string} href        - URL destino al hacer click
 * @param {string} badge       - Texto adicional opcional (ej: "3 tareas")
 */
export function renderGameCard(game, { enabled = true, href = '#', badge = '', onClick } = {}) {
  const disabledClass = enabled ? '' : 'game-card--disabled';
  const lockedIcon   = enabled ? '' : '<span class="game-card-lock">🔒</span>';

  return `
    <div class="game-card ${disabledClass}" 
         data-game="${game.id}"
         style="--game-color: ${game.color}; --game-color-dark: ${game.colorDark};"
         ${onClick ? `onclick="${onClick}"` : ''}>
      ${!onClick ? `<a class="game-card-link" href="${enabled ? href : '#'}" aria-disabled="${!enabled}">` : ''}
        <div class="game-card-icon">${game.icon}</div>
        <div class="game-card-name">${escapeHtml(game.name)}</div>
        <div class="game-card-desc">${escapeHtml(game.description)}</div>
        ${badge ? `<span class="game-card-badge">${escapeHtml(badge)}</span>` : ''}
        ${lockedIcon}
      ${!onClick ? '</a>' : ''}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  PARTÍCULAS DE FONDO (canvas animado)
// ══════════════════════════════════════════════════════════════════

export function initParticles(canvasId = 'particles-canvas', color1 = '#6c63ff', color2 = '#00d4ff') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animFrame;

  const resize = () => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * canvas.width;
      this.y  = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.r  = Math.random() * 1.8 + 0.4;
      this.a  = Math.random() * 0.5 + 0.1;
      this.c  = Math.random() > 0.6 ? color1 : color2;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.c;
      ctx.globalAlpha = this.a;
      ctx.fill();
    }
  }

  const init = () => {
    const count = Math.min(80, Math.floor(canvas.width * canvas.height / 12000));
    particles = Array.from({ length: count }, () => new Particle());
  };

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Grid lines
    ctx.strokeStyle = 'rgba(108,99,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Conexiones
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = color2;
          ctx.globalAlpha = (1 - d / 100) * 0.12;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    particles.forEach(p => { p.update(); p.draw(); });
    animFrame = requestAnimationFrame(animate);
  };

  window.addEventListener('resize', () => { resize(); init(); });
  resize(); init(); animate();

  return () => cancelAnimationFrame(animFrame);
}

// ══════════════════════════════════════════════════════════════════
//  ESTADÍSTICAS — Renderizar podio
// ══════════════════════════════════════════════════════════════════

export function renderPodium(ranking, containerId) {
  const container = $(containerId);
  if (!container) return;
  if (ranking.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay resultados todavía.</p>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const top = ranking.slice(0, 3);

  container.innerHTML = `
    <div class="podium">
      ${top.map((r, i) => `
        <div class="podium-position podium-position--${i + 1}">
          <div class="podium-medal">${medals[i]}</div>
          <img class="podium-avatar" 
               src="${escapeHtml(r.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.studentId}`)}"
               alt="${escapeHtml(r.displayNameAnonymized || r.displayName || 'Alumno')}">
          <div class="podium-name">${escapeHtml(r.displayNameAnonymized || r.displayName || 'Alumno')}</div>
          <div class="podium-score">${r.score}</div>
          <div class="podium-bar"></div>
        </div>
      `).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  TABLA DE RANKING
// ══════════════════════════════════════════════════════════════════

export function renderRankingTable(ranking, containerId, { myUid = null } = {}) {
  const container = $(containerId);
  if (!container) return;
  if (ranking.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay resultados todavía.</p>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = `
    <table class="ranking-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Alumno</th>
          <th>Puntuación</th>
        </tr>
      </thead>
      <tbody>
        ${ranking.map((r, i) => `
          <tr class="${r.studentId === myUid ? 'ranking-table__row--me' : ''}">
            <td class="ranking-pos">${medals[i] || i + 1}</td>
            <td class="ranking-name">
              <img class="ranking-avatar" 
                   src="${escapeHtml(r.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.studentId}`)}"
                   alt="">
              ${escapeHtml(r.displayNameAnonymized || r.displayName || 'Alumno')}
            </td>
            <td class="ranking-score">${r.score}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

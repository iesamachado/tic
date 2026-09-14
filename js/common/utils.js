// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — Utils (Utilidades comunes)
// ═══════════════════════════════════════════════════════════════════════

/** Genera un PIN numérico de 6 dígitos */
export function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Genera un código de sala alfanumérico de 6 caracteres (sin vocales ni ambiguos) */
export function generateRoomCode() {
  const chars = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Avatar robot DiceBear a partir del UID */
export function generateAvatar(uid) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=00e5ff,transparent`;
}

/** Avatar persona DiceBear (para profesores) */
export function generateTeacherAvatar(uid) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}&backgroundColor=b6e3f4`;
}

/** Anonimiza nombre: "Nombre Apellido1 Apellido2" → "Nombre A1A2" */
export function anonymizeName(fullName) {
  if (!fullName) return 'Alumno Anónimo';
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  const initials = parts.slice(1).map(p => p.charAt(0).toUpperCase()).join('');
  return `${parts[0]} ${initials}`;
}

/** Formatea timestamp Firebase → "dd/mm/yyyy HH:MM" */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** Formatea segundos → "MM:SS" */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Formatea tiempo relativo → "hace 5 min", "hace 2 días" */
export function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

/** Copia texto al portapapeles */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  }
}

/** Convierte una puntuación a nota sobre 10 con umbral configurable */
export function scoreToGrade(score, targetScore) {
  if (!targetScore || targetScore <= 0) return 0;
  return Math.min(10, Math.round((score / targetScore) * 100) / 10);
}

/** Parámetros de URL como objeto */
export function getUrlParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

/** Selecciona elemento por ID con shorthand */
export const $ = id => document.getElementById(id);

/** Selecciona todos los elementos por selector */
export const $$ = sel => document.querySelectorAll(sel);

/** Escapa HTML para evitar XSS */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Espera N milisegundos */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Devuelve la URL absoluta correcta dentro de la aplicación para una ruta relativa dada.
 * Funciona de forma precisa en localhost, GitHub Pages (ej: /cyr/) o cualquier subdirectorio.
 * @param {string} relativePath - Ruta relativa a la raíz del proyecto (ej: 'index.html', 'dashboard_student.html')
 */
export function getAppUrl(relativePath = '') {
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return new URL(`../../${cleanPath}`, import.meta.url).href;
}

/** Metadatos de los juegos disponibles */
export const GAMES = {
  hex_invaders: {
    id: 'hex_invaders',
    name: 'Hex Invaders',
    description: 'Defiende tu base disparando a los alienígenas correctos leyendo su código Hexadecimal (CSS).',
    icon: '👾',
    type: 'arcade',
    gamePath: 'hex_invaders/index.html',
    color: '#9b59b6',
    colorDark: '#8e44ad'
  },
  cert_arcade: {
    id: 'cert_arcade',
    name: 'Certificado Arcade',
    description: 'Acompaña a nuestro personaje a sacarse el Certificado Digital en la vida real.',
    icon: '🏛️',
    type: 'arcade',
    gamePath: 'cert_arcade/index.html',
    color: '#00d4ff',
    colorDark: '#008bbf'
  },
  cc_trivial: {
    id: 'cc_trivial',
    name: 'Radio Trivial CC',
    description: 'Estás produciendo el podcast de la radio escolar. Responde al trivial para saber qué música o efectos puedes usar legalmente.',
    icon: '🎙️',
    type: 'quiz',
    gamePath: 'cc_trivial/index.html',
    color: '#f5a623',
    colorDark: '#c4841a'
  }
};

export const TOPICS = {
  topic_kanban: {
    id: 'topic_kanban',
    name: '1. Metodologías Ágiles (Kanban)',
    description: 'Organización y ciclo de vida',
    icon: '📋',
    htmlPath: 'temario/kanban.html',
    color: '#4a90e2'
  },
  topic_drive: {
    id: 'topic_drive',
    name: '2. Ofimática Colaborativa',
    description: 'Trabajo en la nube (Docs/Drive)',
    icon: '☁️',
    htmlPath: 'temario/drive.html',
    color: '#34a853'
  },
  topic_audacity: {
    id: 'topic_audacity',
    name: '3. Edición de Audio',
    description: 'Mesas de mezcla, podcasting y Audacity',
    icon: '🎙️',
    htmlPath: 'temario/audacity.html',
    color: '#f39c12'
  },
  topic_gimp: {
    id: 'topic_gimp',
    name: '4. Edición de Imagen',
    description: 'Resoluciones, capas y GIMP',
    icon: '🎨',
    htmlPath: 'temario/gimp.html',
    color: '#8e44ad'
  },
  topic_wordpress: {
    id: 'topic_wordpress',
    name: '5. Gestores de Contenido (WordPress)',
    description: 'Creación de sitios web con CMS',
    icon: '📰',
    htmlPath: 'temario/wordpress.html',
    color: '#2980b9'
  },
  topic_wiki: {
    id: 'topic_wiki',
    name: '6. Entornos Wikis',
    description: 'Documentación colaborativa',
    icon: '📖',
    htmlPath: 'temario/wiki.html',
    color: '#16a085'
  },
  topic_cc: {
    id: 'topic_cc',
    name: '7. Propiedad Intelectual',
    description: 'Creative Commons y Derechos de autor',
    icon: '©️',
    htmlPath: 'temario/cc.html',
    color: '#f5a623',
    colorDark: '#c4841a'
  },
  topic_cyber: {
    id: 'topic_cyber',
    name: '8. Ciberseguridad Básica',
    description: 'Contraseñas, 2FA y Privacidad',
    icon: '🔐',
    htmlPath: 'temario/cyber.html',
    color: '#d0021b'
  },
  topic_cert: {
    id: 'topic_cert',
    name: '9. Certificados Digitales',
    description: 'Firma electrónica y FNMT',
    icon: '🏛️',
    htmlPath: 'temario/cert.html',
    color: '#00d4ff',
    colorDark: '#008bbf'
  },
  topic_html: {
    id: 'topic_html',
    name: '10. Desarrollo Web (HTML/CSS)',
    description: 'Estructura visual de internet',
    icon: '🌐',
    htmlPath: 'temario/html.html',
    color: '#e34c26'
  },
    topic_js: {
    id: 'topic_js',
    name: '11. Programación JavaScript',
    description: 'Lógica, DOM y Eventos',
    icon: '💻',
    htmlPath: 'temario/js.html',
    color: '#f1c40f'
  },
  topic_js_adv: {
    id: 'topic_js_adv',
    name: '12. JS Avanzado y Antigravity',
    description: 'Web Apps, Firebase y Agentes IA',
    icon: '🚀',
    htmlPath: 'temario/js_advanced.html',
    color: '#8e44ad'
  }
};

export const GAMES_CRITERIA_MAPPING = {
  hex_invaders: {
    '2º Bachillerato': 'TIC2.3.1 (Contenidos en la web)'
  },
  cert_arcade: {
    '2º Bachillerato': 'TIC2.2.1 (Medidas de seguridad) / TIC2.2.2 (Privacidad en Internet)'
  },
  cc_trivial: {
    '2º Bachillerato': 'TIC2.4.1 (Trabajo colaborativo y derechos) / TIC2.3.1 (Contenidos en la web)'
  }
};

export const CYR_EVALUATION_DATA = {
  2: [
    { crit: '1.1', text: 'Analizar y valorar el impacto de la industria de desarrollo de software en la sociedad actual.', block: 'A. Desarrollo de Software', current: '-', prop: '-' },
    { crit: '2.1', text: 'Emplear medidas de seguridad informática necesarias.', block: 'C. Seguridad Informática', current: 'Certificado Arcade', prop: 'Wiki Ciberseguridad, UVUS' },
    { crit: '2.2', text: 'Proteger la privacidad en Internet.', block: 'C. Seguridad Informática', current: '-', prop: 'Wiki Ciberseguridad' },
    { crit: '3.1', text: 'Elaborar y publicar contenidos en la web.', block: 'B. Publicación de contenidos', current: '-', prop: 'Web HTML, WordPress, Guión Podcast, Hex Invaders' },
    { crit: '4.1', text: 'Trabajar colaborativamente respetando los derechos de autor.', block: 'B. Publicación de contenidos', current: 'CC Trivial', prop: 'Podcast Audacity, Ivoox/Spotify' },
    { crit: '5.1', text: 'Desarrollar una variedad de aplicaciones informáticas.', block: 'A. Desarrollo de Software', current: '-', prop: 'SuperMario Move Move, Crea tu App' },
    { crit: '5.2', text: 'Aplicar los principales pasos del ciclo de vida de una aplicación.', block: 'A. Desarrollo de Software', current: '-', prop: 'Tablero Kanban, Crea tu App' },
    { crit: '5.3', text: 'Analizar y resolver problemas de tratamiento de la información.', block: 'A. Desarrollo de Software', current: '-', prop: 'Crea tu App' }
  ]
};

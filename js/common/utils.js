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
  netdefender: {
    id: 'netdefender',
    name: 'NetDefender',
    description: 'Juego de defensa activa contra ataques informáticos',
    icon: '🛡️',
    color: '#ef4444',
    colorDark: '#b91c1c',
    path: './netdefender/index.html',
    gamePath: './netdefender/index.html'
  },
  trivial: {
    id: 'trivial',
    name: 'CyR Trivial',
    description: 'Demuestra lo que sabes respondiendo rápido',
    icon: '❓',
    color: '#eab308',
    colorDark: '#a16207',
    path: './trivial/index.html',
    gamePath: './trivial/index.html'
  },

  mecanoclass: {
    id: 'mecanoclass',
    name: 'MecanoClass',
    description: 'Juego de mecanografía con modo en vivo',
    icon: '⌨️',
    color: '#00d4ff',
    colorDark: '#007a99',
    path: './mecanoclass/index.html',
    gamePath: './mecanoclass/index.html'
  },
  rompecodigos: {
    id: 'rompecodigos',
    name: 'RompeCódigos',
    description: 'Descifra mensajes cifrados en equipo',
    icon: '🔐',
    color: '#ff6b35',
    colorDark: '#c44a1a',
    path: './rompecodigos/index.html',
    gamePath: './rompecodigos/index.html'
  },
  helados: {
    id: 'helados',
    name: 'H3L4D0S',
    description: 'Sirve helados y aprende programación',
    icon: '🍦',
    color: '#ff8fab',
    colorDark: '#cc5a7a',
    path: './helados/index.html',
    gamePath: './helados/game.html'
  },
  moon: {
    id: 'moon',
    name: 'MOON',
    description: 'Aventura espacial de plataformas',
    icon: '🌙',
    color: '#a8d8ea',
    colorDark: '#5a9bb5',
    path: './moon/index.html',
    gamePath: './moon/game.html'
  },
  arenabots: {
    id: 'arenabots',
    name: 'ArenaBots',
    description: 'Programa tu robot para la batalla',
    icon: '🤖',
    color: '#00e5ff',
    colorDark: '#0099aa',
    path: './arenabots/index.html',
    gamePath: './arenabots/index.html'
  },
  cybersmith: {
    id: 'cybersmith',
    name: 'CyberSmith',
    description: 'Monta tu ordenador y aprende hardware',
    icon: '🛠️',
    color: '#b8e986',
    colorDark: '#7ed321',
    path: './cybersmith/index.html',
    gamePath: './cybersmith/index.html'
  },
  asimov: {
    id: 'asimov',
    name: 'Asimov.IO',
    description: 'Simulador ético de Inteligencia Artificial',
    icon: '⚖️',
    color: '#3b82f6',
    colorDark: '#1d4ed8',
    path: './asimov/index.html',
    gamePath: './asimov/index.html'
  },
  appflow: {
    id: 'appflow',
    name: 'AppFlow',
    description: 'Conecta eventos y sensores en móviles',
    icon: '📱',
    color: '#bb86fc',
    colorDark: '#9965f4',
    path: './appflow/index.html',
    gamePath: './appflow/game.html'
  }
};

/** Metadatos de los temas (Syllabus) */
export const TOPICS = {
  block1: {
    id: 'block1',
    name: 'Bloque 1: Alfabetización Digital',
    description: 'Uso del ordenador, carpetas y nube',
    icon: '💻',
    htmlPath: 'temario/block1.html',
    color: '#4a90e2'
  },
  block2: {
    id: 'block2',
    name: 'Bloque 2: Programación',
    description: 'Programación por bloques con Scratch',
    icon: '🧩',
    htmlPath: 'temario/block2.html',
    color: '#f5a623'
  },
  block3: {
    id: 'block3',
    name: 'Bloque 3: Robótica',
    description: 'Computación física con Micro:bit',
    icon: '🤖',
    htmlPath: 'temario/block3.html',
    color: '#d0021b'
  },


  block4: {
    id: 'block4',
    name: 'Bloque 4: IoT y Móvil',
    description: 'Sensores, Redes y Apps',
    icon: '📱',
    htmlPath: 'temario/block4.html',
    color: '#00bcd4'
  },
  block5: {
    id: 'block5',
    name: 'Bloque 5: Inteligencia Artificial',
    description: 'IA generativa y tecnologías emergentes',
    icon: '🧠',
    htmlPath: 'temario/block5.html',
    color: '#9013fe'
  },
  block6: {
    id: 'block6',
    name: 'Bloque 6: Ciberseguridad',
    description: 'Ciudadanía digital y seguridad en red',
    icon: '🛡️',
    htmlPath: 'temario/block6.html',
    color: '#50e3c2'
  }
};

/** Mapeo sugerido de criterios de evaluación de Computación y Robótica (Andalucía) */
export const GAMES_CRITERIA_MAPPING = {
  mecanoclass: {
    '1º ESO': 'CYR.1.F.1 (Sistemas de computación) / CYR.1.I.1 (Seguridad activa y pasiva)',
    '2º ESO': 'CYR.2.F.1 (Tipologías de sistemas) / CYR.2.I.1 (Privacidad e identidad)',
    '3º ESO': 'CYR.3.F.1 (Aplicaciones computacionales) / CYR.3.I.2 (Necesidad y concienciación)'
  },
  rompecodigos: {
    '1º ESO': 'CYR.1.I.1 (Seguridad activa y pasiva), CYR.1.I.3 (Peligros en Internet)',
    '2º ESO': 'CYR.2.I.1 (Privacidad e identidad), CYR.2.I.2 (Riesgos por exposición)',
    '3º ESO': 'CYR.3.I.1 (Tipologías de Ciberseguridad), CYR.3.I.2 (Ciberseguridad: necesidad)'
  },
  helados: {
    '1º ESO': 'CYR.1.A.3 (Algoritmos y secuencias), CYR.1.A.4 (Tareas repetitivas y condicionales)',
    '2º ESO': 'CYR.2.A.2 (Programas con bloques), CYR.2.A.4 (Tareas repetitivas y condicionales)',
    '3º ESO': 'CYR.3.A.2 (Especificaciones en bloques), CYR.3.A.4 (Bucles y condicionales anidadas)'
  },
  arenabots: {
    '1º ESO': 'CYR.1.C.1 (Definición de robot), CYR.1.C.5 (Programación de robots)',
    '2º ESO': 'CYR.2.C.2 (Aplicaciones de robots), CYR.2.C.5 (Programación con bloques)',
    '3º ESO': 'CYR.3.C.3 (Morfología de robots), CYR.3.C.5 (Programación texto/microprocesadores)'
  },
  moon: {
    '1º ESO': 'CYR.1.A.5 (Interacción con el usuario), CYR.1.A.1 (Introducción a lenguajes visuales)',
    '2º ESO': 'CYR.2.A.5 (Pantallas de interacción con el usuario)',
    '3º ESO': 'CYR.3.A.5 (Entornos de interacción con el usuario)'
  },
  cybersmith: {
    '1º ESO': 'CYR.1.F.1 (Componentes Hardware), CYR.1.C.1 (Computación física)',
    '2º ESO': 'CYR.2.F.1 (Tipologías de sistemas físicos)',
    '3º ESO': 'CYR.3.F.1 (Sistemas de computación física)'
  }
};

export const CYR_EVALUATION_DATA = {
  1: [
    { crit: '1.1', text: 'Comprender el funcionamiento global de los sistemas de computación física y sus componentes.', block: 'F. Computación física (Hardware)', current: 'MecanoClass, CyberSmith', prop: '1. Carpetas, 3. Mecanografía, N1. Usuarios' },
    { crit: '1.2', text: 'Reconocer el papel de la robótica en nuestra sociedad.', block: 'C. Robótica', current: '-', prop: '15. Dispositivos/Red, 17. Test Asimov' },
    { crit: '1.3', text: 'Entender la estructura básica de un programa informático.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '7. Oso Polar, 8. Escarabajo, 9. Elefante, 11. Gato Bross, 12. Code.org' },
    { crit: '1.4', text: 'Comprender los principios básicos de ingeniería en los que se basan los robots.', block: 'C. Robótica', current: 'ArenaBots', prop: '20. Cutebot Siguelíneas, N4. Esquiva-obstáculos' },
    { crit: '2.1', text: 'Conocer y resolver problemas desarrollando un programa informático con bloques.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '4. Píxeles, 5. Diagramas, 6. Test Algoritmos, N3. Depuración' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de las aplicaciones y cómo se construyen.', block: 'D. Desarrollo', current: '-', prop: '10. Mapa Interactivo, 18. Juego Micro:bit' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico.', block: 'C/F. Proyecto Físico', current: 'CyberSmith', prop: '19. Código Morse, 21. Coche Teledirigido' },
    { crit: '4.1', text: 'Conocer distintos tipos de datos, analizarlos y visualizarlos.', block: 'G. Datos masivos', current: '-', prop: '22. Canción IA, 23. Dibujando IA, 26. La sed de ChatGPT' },
    { crit: '4.2', text: 'Comprender los principios básicos de agentes inteligentes y aprendizaje automático.', block: 'H. Inteligencia Artificial', current: '-', prop: '24. Entrena IA, 25. Test IA, N5. Cómic IA' },
    { crit: '5.1', text: 'Conocer la construcción de aplicaciones web y de forma segura.', block: 'E. Desarrollo Web', current: '-', prop: '0. Quién eres, N2. Gestión Archivos' },
    { crit: '5.2', text: 'Resolver la variedad de problemas de una aplicación web.', block: 'E. Desarrollo Web', current: '-', prop: '13. Felicitación GIMP, 14. Crea tu web' },
    { crit: '6.1', text: 'Adoptar conductas y hábitos que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: '16. Bienestar Digital, N7. Phishing' },
    { crit: '6.2', text: 'Acceder a servicios de publicación aplicando criterios de seguridad.', block: 'I. Ciberseguridad', current: '-', prop: '2. Envío eMails, N6. Retos INCIBE' },
    { crit: '6.3', text: 'Reconocer los derechos de los materiales alojados en la web.', block: 'I. Ciberseguridad', current: '-', prop: '27. Creative Commons, 28. Infografía Ciberseg.' },
    { crit: '6.4', text: 'Adoptar conductas de seguridad activa y pasiva en protección de datos.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: '29. Contraseñas seguras, N8. Seguridad Act/Pas.' }
  ],
  2: [
    { crit: '1.1', text: 'Comprender el funcionamiento de los sistemas de computación física.', block: 'F. Computación física', current: 'MecanoClass, CyberSmith', prop: '-' },
    { crit: '1.2', text: 'Reconocer el papel de la robótica, conociendo las aplicaciones más comunes.', block: 'C. Robótica', current: '-', prop: 'Asimov.IO' },
    { crit: '1.3', text: 'Entender cómo funciona un programa, elaborarlo y sus componentes.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '-' },
    { crit: '1.4', text: 'Comprender los principios de ingeniería de los robots y su funcionamiento.', block: 'C. Robótica', current: 'ArenaBots', prop: '-' },
    { crit: '2.1', text: 'Conocer y resolver problemas desarrollando un programa informático.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '-' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de las aplicaciones móviles y cómo se construyen.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '2.3', text: 'Resolver problemas desarrollando una aplicación móvil.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico automatizado.', block: 'C/F. Proyecto', current: 'CyberSmith', prop: '-' },
    { crit: '4.1', text: 'Conocer aplicaciones de Big Data, metadatos y emplear espíritu crítico.', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '4.2', text: 'Comprender el aprendizaje automático para resolver situaciones con IA.', block: 'H. Inteligencia Artificial', current: '-', prop: 'NeuroBot' },
    { crit: '5.1', text: 'Conocer la construcción de aplicaciones informáticas y web de forma responsable.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '5.2', text: 'Resolver problemas presentes en el desarrollo de una aplicación web.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '6.1', text: 'Adoptar conductas que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' },
    { crit: '6.2', text: 'Acceder a servicios de publicación aplicando seguridad.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.3', text: 'Reconocer los derechos de propiedad intelectual en Internet.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.4', text: 'Adoptar conductas de seguridad y protección de datos.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' }
  ],
  3: [
    { crit: '1.1', text: 'Comprender el funcionamiento de sistemas de computación física.', block: 'F. Computación física', current: 'MecanoClass, CyberSmith', prop: '-' },
    { crit: '1.2', text: 'Reconocer los conceptos de la robótica y configuraciones morfológicas.', block: 'C. Robótica', current: 'ArenaBots', prop: 'Asimov.IO' },
    { crit: '1.3', text: 'Entender cómo funciona un programa y sus principales componentes.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '-' },
    { crit: '1.4', text: 'Comprender los principios de ingeniería de los robots.', block: 'C. Robótica', current: 'ArenaBots', prop: '-' },
    { crit: '2.1', text: 'Resolver problemas desarrollando programas informáticos.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '-' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de aplicaciones móviles.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '2.3', text: 'Resolver problemas desarrollando una aplicación móvil.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico.', block: 'C/F. Proyecto', current: 'CyberSmith', prop: '-' },
    { crit: '4.1', text: 'Conocer la naturaleza de los distintos tipos de metadatos (Big Data).', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '4.2', text: 'Comprender el funcionamiento de agentes inteligentes e IA.', block: 'H. Inteligencia Artificial', current: '-', prop: 'NeuroBot' },
    { crit: '4.3', text: 'Comprender los principios de funcionamiento del Data Scraping.', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '5.1', text: 'Construcción de aplicaciones web y de forma segura.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '5.2', text: 'Resolver variedad de problemas en aplicaciones web.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '6.1', text: 'Adoptar conductas que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' },
    { crit: '6.2', text: 'Intercambio y publicación de información digital con seguridad.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.3', text: 'Reconocer y comprender la propiedad intelectual.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.4', text: 'Estrategias de ciberseguridad que garantizan protección a usuarios.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' }
  ]
};

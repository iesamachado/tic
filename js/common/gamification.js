import { db } from './db.js';
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- CONFIGURACIÓN ---
export const LEAGUES = [
  { id: 'maestro', name: 'Liga Maestro', pts: 25000, icon: '🏆', color: '#f1c40f' },
  { id: 'diamante', name: 'Liga Diamante', pts: 10000, icon: '💎', color: '#00d2d3' },
  { id: 'platino', name: 'Liga Platino', pts: 5000, icon: '⭐', color: '#9b59b6' },
  { id: 'oro', name: 'Liga Oro', pts: 2000, icon: '🥇', color: '#f39c12' },
  { id: 'plata', name: 'Liga Plata', pts: 500, icon: '🥈', color: '#bdc3c7' },
  { id: 'bronce', name: 'Liga Bronce', pts: 0, icon: '🥉', color: '#cd6133' }
];

export const MEDALS_CATALOG = [
  // Generales y Progresión
  { id: 'first_blood', name: 'Primera Sangre', desc: 'Resuelve tu primer reto o minijuego.', icon: '🩸', public: true },
  { id: 'novato', name: 'Novato', desc: 'Alcanza los 1000 Puntos de Experiencia.', icon: '🌱', public: true },
  { id: 'aprendiz', name: 'Aprendiz', desc: 'Alcanza los 5000 Puntos de Experiencia.', icon: '🎓', public: true },
  { id: 'veterano', name: 'Veterano', desc: 'Alcanza los 10000 Puntos de Experiencia.', icon: '⚔️', public: true },
  { id: 'leyenda', name: 'Leyenda Viva', desc: 'Alcanza los 50000 Puntos de Experiencia.', icon: '👑', public: true },
  { id: 'perfeccionista', name: 'Perfeccionista', desc: 'Termina un minijuego sin fallos o saca un 10 en un test.', icon: '✨', public: true },

  // Constancia y Tiempo
  { id: 'madrugador', name: 'El Madrugador', desc: 'Completa una actividad entre las 6:00 y las 8:00 AM.', icon: '🌅', public: true },
  { id: 'nocturno', name: 'Ave Nocturna', desc: 'Completa una actividad entre las 00:00 y las 4:00 AM.', icon: '🦉', public: true },
  { id: 'finde', name: 'Sin Descanso', desc: 'Realiza una actividad durante el fin de semana.', icon: '🏖️', public: true },
  { id: 'constancia', name: 'Constancia', desc: 'Entra a TIC2Hub tres días seguidos.', icon: '🔥', public: true },
  { id: 'hora_bruja', name: 'La Hora Bruja', desc: '?????', icon: '👻', public: false }, // Oculto: 3:33 AM
  { id: 'relampago', name: 'Rayo', desc: 'Termina un minijuego en tiempo récord.', icon: '⚡', public: true },

  // Exámenes / Tests
  { id: 'maestro_teoria', name: 'Maestro de la Teoría', desc: 'Saca un 10 absoluto en un examen.', icon: '💯', public: true },
  { id: 'casi_perfecto', name: 'Casi Perfecto', desc: 'Saca un 9 en un examen.', icon: '🎯', public: true },
  { id: 'por_los_pelos', name: 'Por los Pelos', desc: 'Saca exactamente un 5 en un examen.', icon: '😅', public: true },
  { id: 'remontada', name: 'La Remontada', desc: 'Saca más de un 8 habiendo suspendido el anterior.', icon: '📈', public: true },
  { id: 'erudito', name: 'Erudito', desc: 'Realiza 5 exámenes distintos.', icon: '📚', public: true },
  { id: 'suerte_ciega', name: 'Suerte Ciega', desc: '?????', icon: '🎲', public: false }, // Oculto: Aprobar contestando en menos de 1 min

  // Databreach (Ciberseguridad)
  { id: 'hacker_novato', name: 'Hacker Novato', desc: 'Completa el primer nivel de Databreach.', icon: '💻', public: true },
  { id: 'bypass_maestro', name: 'Bypass Maestro', desc: 'Usa una inyección SQL para saltarte un login.', icon: '🔓', public: true },
  { id: 'mr_robot', name: 'Mr. Robot', desc: 'Completa todos los niveles de Databreach.', icon: '🥷', public: true },
  { id: 'inyector_sql', name: 'Inyector SQL', desc: '?????', icon: '💉', public: false }, // Oculto: Usa UNION SELECT
  { id: 'rastro_borrado', name: 'Rastro Borrado', desc: '?????', icon: '🗑️', public: false }, // Oculto: DROP TABLE logs;
  { id: 'curioso_db', name: 'Curiosidad Peligrosa', desc: '?????', icon: '🐈', public: false }, // Oculto: SELECT * FROM passwords;

  // CC Trivial (Propiedad Intelectual)
  { id: 'abogado_novato', name: 'Abogado Junior', desc: 'Acierta 5 preguntas seguidas en CC Trivial.', icon: '⚖️', public: true },
  { id: 'juez_supremo', name: 'Juez Supremo', desc: 'Acierta TODAS las preguntas de CC Trivial.', icon: '👨‍⚖️', public: true },
  { id: 'fair_use', name: 'Fair Use', desc: 'Responde correctamente a la pregunta de Derecho de Cita.', icon: '📝', public: true },
  { id: 'dominio_publico', name: 'Dominio Público', desc: 'Termina el CC Trivial muy rápido.', icon: '⏱️', public: true },
  { id: 'pirata_arrepentido', name: 'Pirata Arrepentido', desc: '?????', icon: '🏴‍☠️', public: false }, // Oculto: Fallar pregunta obvia de piratería

  // Cert Arcade (Certificados)
  { id: 'burocrata', name: 'Burócrata', desc: 'Consigue tu primer certificado en Cert Arcade.', icon: '📜', public: true },
  { id: 'firma_digital', name: 'Firma Digital', desc: 'Tramita 5 firmas correctas seguidas.', icon: '✒️', public: true },
  { id: 'ciudadano_ejemplar', name: 'Ciudadano Ejemplar', desc: 'Consigue más de 500 puntos en Cert Arcade.', icon: '🏛️', public: true },
  { id: 'dnie_master', name: 'DNIe Master', desc: 'Llega al nivel máximo de dificultad en Cert Arcade.', icon: '💳', public: true },
  { id: 'revocado', name: 'Certificado Revocado', desc: '?????', icon: '❌', public: false }, // Oculto: Fallar 3 veces un cert inválido

  // Hex Invaders
  { id: 'matematico', name: 'Matemático', desc: 'Destruye 10 naves en Hex Invaders.', icon: '🧮', public: true },
  { id: 'francotirador_hex', name: 'Francotirador Hex', desc: 'Destruye 5 naves seguidas sin fallar un disparo.', icon: '🎯', public: true },
  { id: 'overflow', name: 'Stack Overflow', desc: 'Consigue más de 1000 puntos en Hex Invaders.', icon: '💥', public: true },
  { id: 'hexadecimal_boss', name: 'Jefe Hexadecimal', desc: 'Supera el nivel 5 en Hex Invaders.', icon: '👾', public: true },
  { id: 'panic_button', name: 'Panic Button', desc: '?????', icon: '😱', public: false }, // Oculto: Disparar a lo loco y fallar 10 seguidas

  // Teoría (Aprobando el test del final del tema)
  { id: 'raton_biblioteca', name: 'Ratón de Biblioteca', desc: 'Aprueba tu primer test de un bloque de teoría.', icon: '📖', public: true },
  { id: 'experto_multimedia', name: 'Productor Multimedia', desc: 'Aprueba el test de Edición Multimedia.', icon: '🎙️', public: true },
  { id: 'experto_multimedia_oro', name: 'Productor de Oro', desc: 'Saca más de un 9 en el test de Edición Multimedia.', icon: '🎧', public: true },
  { id: 'maestro_cms', name: 'Webmaster CMS', desc: 'Aprueba el test de WordPress y SEO.', icon: '🌐', public: true },
  { id: 'maestro_cms_oro', name: 'Webmaster de Oro', desc: 'Saca más de un 9 en el test de WordPress y SEO.', icon: '🌍', public: true },
  { id: 'dev_web', name: 'Desarrollador Web', desc: 'Aprueba el test de HTML y JS.', icon: '🖥️', public: true },
  { id: 'dev_web_oro', name: 'Desarrollador de Oro', desc: 'Saca más de un 9 en el test de HTML y JS.', icon: '💻', public: true },
  { id: 'sysadmin', name: 'Sysadmin', desc: 'Aprueba el test de Ciberseguridad.', icon: '🔒', public: true },
  { id: 'sysadmin_oro', name: 'Sysadmin de Oro', desc: 'Saca más de un 9 en el test de Ciberseguridad.', icon: '🛡️', public: true },
  { id: 'kanban_master', name: 'Scrum Master', desc: 'Aprueba el test de Industria del Software.', icon: '📋', public: true },
  { id: 'kanban_master_oro', name: 'Scrum de Oro', desc: 'Saca más de un 9 en el test de Industria del Software.', icon: '📊', public: true }
];

// --- FUNCIONES NÚCLEO ---

/**
 * Devuelve la liga actual en base a los puntos.
 */
export function getLeague(points) {
  for (let liga of LEAGUES) {
    if (points >= liga.pts) return liga;
  }
  return LEAGUES[LEAGUES.length - 1]; // Bronce por defecto
}

/**
 * Añade puntos (XP) a un usuario, y opcionalmente a su gremio.
 * Calcula si ha subido de liga o desbloqueado medallas.
 * @param {string} userId - ID del usuario en Firestore (ej. tic2_users)
 * @param {number} points - Puntos a sumar
 * @param {string} [guildId] - (Opcional) ID del gremio
 * @param {string} [collectionName='tic2_users'] - Colección de usuarios para que sea exportable
 */
export async function addPointsAndCheckLogros(userId, points, guildId = null, collectionName = 'tic2_users') {
  if (!userId || points === 0) return { success: false };

  const userRef = doc(db, collectionName, userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    console.warn("Usuario no encontrado para gamificación:", userId);
    return { success: false };
  }

  const userData = userSnap.data();
  const currentPts = userData.puntosTotal || 0;
  const newPts = currentPts + points;
  
  const currentLeague = getLeague(currentPts);
  const newLeague = getLeague(newPts);
  const leagueUp = newLeague.id !== currentLeague.id && newPts > currentPts;

  await updateDoc(userRef, {
    puntosTotal: increment(points)
  });

  // Si tiene gremio, sumar puntos al gremio
  if (guildId) {
    const guildRef = doc(db, 'gremios', guildId);
    await setDoc(guildRef, {
      puntosTotales: increment(points)
    }, { merge: true });
  }

  // Evaluar medallas genéricas (ej. por hora del día)
  const nuevasMedallas = await _evaluarMedallasTemporales(userId, collectionName, userData.logros || []);

  return { 
    success: true, 
    newPoints: newPts, 
    leagueUp, 
    newLeague,
    nuevasMedallas
  };
}

/**
 * Otorga una medalla específica a un usuario si no la tiene ya.
 */
export async function awardMedal(userId, medalId, collectionName = 'tic2_users') {
  const userRef = doc(db, collectionName, userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return false;
  
  const userLogros = userSnap.data().logros || [];
  
  if (userLogros.some(m => m.id === medalId)) {
    return false; // Ya la tiene
  }

  const medal = MEDALS_CATALOG.find(m => m.id === medalId);
  if (!medal) return false;

  const medalObj = {
    id: medal.id,
    name: medal.name,
    icon: medal.icon,
    desc: medal.desc,
    fecha: new Date().toISOString()
  };

  await updateDoc(userRef, {
    logros: arrayUnion(medalObj)
  });

  return medalObj;
}

/**
 * Función interna para evaluar logros de tiempo u otros genéricos que se revisan en cada acción.
 */
async function _evaluarMedallasTemporales(userId, collectionName, userLogros) {
  const nuevas = [];
  const hasLogro = (id) => userLogros.some(l => l.id === id);
  
  const date = new Date();
  const h = date.getHours();
  
  if (h >= 6 && h <= 8 && !hasLogro('madrugador')) {
    const m = await awardMedal(userId, 'madrugador', collectionName);
    if (m) nuevas.push(m);
  }
  
  if (h >= 0 && h <= 4 && !hasLogro('nocturno')) {
    const m = await awardMedal(userId, 'nocturno', collectionName);
    if (m) nuevas.push(m);
  }

  return nuevas;
}

// --- RENDER UI (OPCIONAL/EXPORTABLE) ---
export function renderLeagueCard(points) {
  const liga = getLeague(points);
  return `
    <div class="gamification-card" style="border: 2px solid ${liga.color}; border-radius: 8px; padding: 15px; text-align: center;">
      <div style="font-size: 2.5rem;">${liga.icon}</div>
      <h4 style="color: ${liga.color}; margin: 10px 0 5px 0;">${liga.name}</h4>
      <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">${points} XP</p>
    </div>
  `;
}

export const GUILDS_CATALOG = [
  {
    id: 'turing',
    name: 'La Hermandad de Turing',
    icon: '🗝️',
    color: '#8e44ad',
    desc: 'Herederos del mismísimo Alan Turing. Maestros de la lógica y la criptografía. Su objetivo es descifrar los secretos mejor guardados del ciberespacio.'
  },
  {
    id: 'lovelace',
    name: 'Los Hijos de Lovelace',
    icon: '⚙️',
    color: '#2980b9',
    desc: 'Bajo el manto de Ada Lovelace, la primera programadora de la historia. Son los arquitectos del código, estructurados, analíticos y elegantes.'
  },
  {
    id: 'hopper',
    name: 'El Escuadrón de Hopper',
    icon: '🐛',
    color: '#16a085',
    desc: 'Inspirados en Grace Hopper. Compiladores natos, depuradores incansables y siempre listos para encontrar y aplastar cualquier "bug" en el código.'
  },
  {
    id: 'stallman',
    name: 'La Resistencia de Stallman',
    icon: '🐃',
    color: '#e67e22',
    desc: 'Devotos del Software Libre y herederos de la filosofía GNU de Richard Stallman. Luchan por la libertad del código y el conocimiento sin cadenas.'
  }
];

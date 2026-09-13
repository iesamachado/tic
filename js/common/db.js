// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — DB (Capa de datos Firestore unificada)
//  -----------------------------------------------------------------------
//  Colecciones:
//    users/{uid}                     → perfiles de usuario
//    classes/{classId}               → clases gestionadas por profesores
//    classes/{classId}/assignments/  → tareas vinculadas a Classroom
//    class_members/{classId_uid}     → alumnos que se unieron por PIN
//    game_results/{autoId}           → resultados de todos los juegos
//    live_sessions/{pin}             → sesiones en vivo (MecanoClass/RompeCodigos)
//    live_participants/{pin_uid}     → participantes de sesiones en vivo
//    mecanoclass_texts/{autoId}      → textos de práctica para MecanoClass
//    settings/site                   → configuración global
// ═══════════════════════════════════════════════════════════════════════

import {
  db,
  doc, collection,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  arrayUnion, arrayRemove,
  serverTimestamp, Timestamp,
  onSnapshot
} from './firebase-config.js';
import { generatePin, generateRoomCode } from './utils.js';

// ══════════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════════

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'tic2_users', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, 'tic2_users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** Busca usuarios por email (para importación desde Classroom) */
export async function findUserByEmail(email) {
  const q = query(collection(db, 'tic2_users'), where('email', '==', email));
  const snap = await getDocs(q);
  return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// ══════════════════════════════════════════════════════════════════
//  CLASES
// ══════════════════════════════════════════════════════════════════

/**
 * Crea una nueva clase.
 * @param {string} teacherId
 * @param {string} name
 * @param {object} extra - campos adicionales (classroomCourseId, etc.)
 * @returns {object} { id, pin, name }
 */
export async function createClass(teacherId, name, level = 1, extra = {}) {
  const pin = generatePin();
  const ref = doc(collection(db, 'tic2_classes'));
  await setDoc(ref, {
    id:           ref.id,
    teacherId,
    name,
    level,
    pin,
    enabledGames: [],   // El profesor los habilita después
    members:      [],   // UIDs de alumnos importados desde Classroom
    ...extra,
    createdAt:    serverTimestamp()
  });
  return { id: ref.id, pin, name, ...extra };
}

export async function getClass(classId) {
  const snap = await getDoc(doc(db, 'tic2_classes', classId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTeacherClasses(teacherId) {
  const q = query(collection(db, 'tic2_classes'), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return classes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * Comprueba si el alumno está registrado en alguna clase
 */
export async function isStudentInAnyClass(email) {
  if (!email) return false;
  email = email.toLowerCase().trim();
  
  try {
    const snap = await getDoc(doc(db, 'tic2_allowed_students', email));
    if (snap.exists()) return true;

    // Fallback: buscar en todas las clases por si falta el documento en allowed_students
    const q = query(collection(db, 'tic2_classes'));
    const classesSnap = await getDocs(q);
    for (const d of classesSnap.docs) {
      const cls = d.data();
      if (!cls.members) continue;
      const found = cls.members.some(m => 
        (typeof m === 'string' && m === email) || 
        (m && typeof m === 'object' && m.email?.toLowerCase() === email)
      );
      if (found) {
        // Reparar el documento faltante
        await setDoc(doc(db, 'tic2_allowed_students', email), { allowed: true, recovered: true }, { merge: true });
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error comprobando si el alumno está en una clase:', err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
//  DOCENTES Y ADMINISTRADORES AUTORIZADOS
// ══════════════════════════════════════════════════════════════════

export const SUPERADMIN_EMAIL = 'bernatcosta@iesamachado.org';

/**
 * Comprueba si un docente está autorizado en el sistema
 */
export async function isTeacherAuthorized(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) {
    return { email: cleanEmail, role: 'admin', name: 'Superadmin', isSuperAdmin: true };
  }

  try {
    const snap = await getDoc(doc(db, 'tic2_allowed_teachers', cleanEmail));
    if (snap.exists()) {
      return { email: cleanEmail, ...snap.data() };
    }
    return null;
  } catch (err) {
    console.error('Error comprobando autorización docente:', err);
    return null;
  }
}

/**
 * Obtiene todos los docentes y administradores autorizados
 */
export async function getAllowedTeachers() {
  try {
    const snap = await getDocs(collection(db, 'tic2_allowed_teachers'));
    const list = snap.docs.map(d => ({ email: d.id, ...d.data() }));

    // Asegurar que el superadmin siempre aparezca en la lista
    const hasSuperAdmin = list.some(t => t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase());
    if (!hasSuperAdmin) {
      list.unshift({
        email: SUPERADMIN_EMAIL,
        name: 'Bernat Costa (Superadmin)',
        role: 'admin',
        isSuperAdmin: true,
        createdAt: null
      });
    } else {
      list.forEach(t => {
        if (t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
          t.isSuperAdmin = true;
        }
      });
    }

    return list.sort((a, b) => (a.isSuperAdmin ? -1 : b.isSuperAdmin ? 1 : a.email.localeCompare(b.email)));
  } catch (err) {
    console.error('Error obteniendo docentes autorizados:', err);
    return [{
      email: SUPERADMIN_EMAIL,
      name: 'Bernat Costa (Superadmin)',
      role: 'admin',
      isSuperAdmin: true
    }];
  }
}

/**
 * Autoriza un nuevo docente o administrador
 */
export async function addAllowedTeacher(email, { name = '', role = 'teacher', addedBy = '' } = {}) {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) throw new Error('El correo es obligatorio.');

  await setDoc(doc(db, 'tic2_allowed_teachers', cleanEmail), {
    email: cleanEmail,
    name: name.trim() || cleanEmail.split('@')[0],
    role: role === 'admin' ? 'admin' : 'teacher',
    addedBy: addedBy || 'admin',
    createdAt: serverTimestamp()
  }, { merge: true });

  return { email: cleanEmail, name, role };
}

export const authorizeTeacher = addAllowedTeacher;

/**
 * Elimina la autorización de un docente
 */
export async function removeAllowedTeacher(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) {
    throw new Error('No se puede eliminar al superadministrador del sistema.');
  }
  await deleteDoc(doc(db, 'tic2_allowed_teachers', cleanEmail));
}

/**
 * Actualiza el rol de un docente (teacher <-> admin)
 */
export async function updateTeacherRole(email, role) {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase()) {
    throw new Error('El superadministrador siempre mantiene el rol de admin.');
  }
  await updateDoc(doc(db, 'tic2_allowed_teachers', cleanEmail), {
    role: role === 'admin' ? 'admin' : 'teacher',
    updatedAt: serverTimestamp()
  });
}

/**
 * Añade una lista de emails de alumnos a una clase y los autoriza en allowed_students
 */
export async function addStudentsToClass(classId, emailList) {
  if (!classId) throw new Error('ID de clase no proporcionado.');
  
  // Normalizar y separar emails (por saltos de línea, comas o punto y coma)
  const emails = (Array.isArray(emailList) ? emailList : emailList.split(/[\n,;\s]+/))
    .map(e => e.toLowerCase().trim())
    .filter(e => e.includes('@') && e.includes('.'));

  if (emails.length === 0) return { added: 0, existing: 0 };

  const classDoc = await getDoc(doc(db, 'tic2_classes', classId));
  if (!classDoc.exists()) throw new Error('La clase no existe.');

  const currentMembers = classDoc.data().members || [];
  const existingEmailSet = new Set(
    currentMembers.map(m => (typeof m === 'string' ? m : m?.email?.toLowerCase())).filter(Boolean)
  );

  let added = 0;
  let existing = 0;

  for (const email of emails) {
    if (existingEmailSet.has(email)) {
      existing++;
      continue;
    }

    // Buscar si ya tiene cuenta en users
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      if (!existingEmailSet.has(existingUser.uid)) {
        await addMemberToClass(classId, existingUser.uid);
        existingEmailSet.add(existingUser.uid);
        added++;
      }
    } else {
      const displayName = email.split('@')[0];
      await addPendingMember(classId, email, displayName);
      existingEmailSet.add(email);
      added++;
    }

    // Dar de alta en allowed_students para permitir acceso inmediato con Google
    await setDoc(doc(db, 'tic2_allowed_students', email), {
      allowed: true,
      lastClassId: classId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  return { added, existing, total: emails.length };
}

/**
 * Elimina un alumno de una clase (tanto por UID como por email pendiente)
 */
export async function removeStudentFromClass(classId, studentIdOrEmail) {
  if (!classId || !studentIdOrEmail) return;

  const classRef = doc(db, 'tic2_classes', classId);
  const classSnap = await getDoc(classRef);
  if (!classSnap.exists()) return;

  const members = classSnap.data().members || [];
  const updatedMembers = members.filter(m => {
    if (typeof m === 'string') {
      return m !== studentIdOrEmail;
    } else if (m && typeof m === 'object') {
      return m.email?.toLowerCase() !== studentIdOrEmail.toLowerCase();
    }
    return true;
  });

  await updateDoc(classRef, {
    members: updatedMembers,
    updatedAt: serverTimestamp()
  });

  // También eliminar membresía por PIN si existe
  try {
    const memberDocId = `${classId}_${studentIdOrEmail}`;
    await deleteDoc(doc(db, 'tic2_class_members', memberDocId));
  } catch (e) {
    // Si no existe, ignorar
  }
}


/**
 * Clases donde el alumno aparece en 'members' (importados desde Classroom)
 * o en la colección 'tic2_class_members' (unión por PIN).
 */
export async function getStudentClasses(studentId) {
  // 1. Clases donde está en el array 'members' (como UID)
  const q1 = query(collection(db, 'tic2_classes'), where('members', 'array-contains', studentId));
  const snap1 = await getDocs(q1);
  const byMembers = snap1.docs.map(d => ({ id: d.id, ...d.data() }));

  // Obtener email del usuario para auto-reparar clases pendientes
  let email = null;
  try {
    const userSnap = await getDoc(doc(db, 'tic2_users', studentId));
    if (userSnap.exists()) {
      email = (userSnap.data().email || '').toLowerCase().trim();
    }
  } catch (e) {}

  // 2. Clases donde se unió por PIN
  const q2 = query(collection(db, 'tic2_class_members'), where('studentId', '==', studentId));
  const snap2 = await getDocs(q2);
  const classIdsByPin = snap2.docs.map(d => d.data().classId);

  // 3. Cargar los docs de esas clases (evitando duplicados)
  const alreadyLoaded = new Set(byMembers.map(c => c.id));
  const byPinClasses = [];
  for (const cid of classIdsByPin) {
    if (!alreadyLoaded.has(cid)) {
      const cls = await getClass(cid);
      if (cls) {
        byPinClasses.push(cls);
        alreadyLoaded.add(cls.id);
      }
    }
  }

  return [...byMembers, ...byPinClasses].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

/** Unirse a una clase por PIN */
export async function joinClassByPin(studentId, pin) {
  const q = query(collection(db, 'tic2_classes'), where('pin', '==', pin));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('No se encontró ninguna clase con ese PIN.');

  const classDoc = snap.docs[0];
  const classData = { id: classDoc.id, ...classDoc.data() };

  // Registrar en class_members
  const memberId = `${classDoc.id}_${studentId}`;
  await setDoc(doc(db, 'tic2_class_members', memberId), {
    classId:    classDoc.id,
    studentId,
    joinedAt:   serverTimestamp()
  }, { merge: true });

  return classData;
}

/** Habilitar / deshabilitar un juego en una clase */
export async function toggleGameInClass(classId, gameId, enabled) {
  const ref = doc(db, 'tic2_classes', classId);
  await updateDoc(ref, {
    enabledGames: enabled ? arrayUnion(gameId) : arrayRemove(gameId),
    updatedAt: serverTimestamp()
  });
}

/** Habilitar / deshabilitar un tema en una clase */
export async function toggleTopicInClass(classId, topicId, enabled) {
  const ref = doc(db, 'tic2_classes', classId);
  await updateDoc(ref, {
    enabledTopics: enabled ? arrayUnion(topicId) : arrayRemove(topicId),
    updatedAt: serverTimestamp()
  });
}

/** Actualizar nombre de clase */
export async function updateClass(classId, data) {
  await updateDoc(doc(db, 'tic2_classes', classId), { ...data, updatedAt: serverTimestamp() });
}

/** Eliminar clase */
export async function deleteClass(classId) {
  await deleteDoc(doc(db, 'tic2_classes', classId));
}

/** Obtener miembros de una clase (fusión de ambas fuentes) */
export async function getClassMembers(classId) {
  const memberIds = new Set();
  const members   = [];

  // Fuente 1: class_members (unión por PIN)
  const q1 = query(collection(db, 'tic2_class_members'), where('classId', '==', classId));
  const snap1 = await getDocs(q1);
  for (const d of snap1.docs) {
    const { studentId, joinedAt } = d.data();
    if (!memberIds.has(studentId)) {
      memberIds.add(studentId);
      const profile = await getUserProfile(studentId);
      if (profile) members.push({ ...profile, joinedAt, source: 'pin' });
    }
  }

  // Fuente 2: array members del doc de clase (importación Classroom)
  const classSnap = await getDoc(doc(db, 'tic2_classes', classId));
  let needsHeal = false;
  let newMembersArr = [];

  if (classSnap.exists()) {
    const { members: arr = [] } = classSnap.data();
    newMembersArr = [...arr];

    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (typeof entry === 'string') {
        // UID directo
        if (!memberIds.has(entry)) {
          memberIds.add(entry);
          const profile = await getUserProfile(entry);
          if (profile) members.push({ ...profile, joinedAt: null, source: 'classroom' });
        }
      } else if (entry?.pending) {
        // Alumno pendiente: comprobar si ya se ha registrado en users
        const registeredUser = await findUserByEmail(entry.email);
        if (registeredUser) {
          // Auto-reparar: el usuario ya existe.
          needsHeal = true;
          // Reemplazar el objeto pending por su UID
          newMembersArr = newMembersArr.filter(e => e !== entry);
          if (!newMembersArr.includes(registeredUser.uid)) {
            newMembersArr.push(registeredUser.uid);
          }
          if (!memberIds.has(registeredUser.uid)) {
            memberIds.add(registeredUser.uid);
            members.push({ ...registeredUser, joinedAt: null, source: 'classroom' });
          }
        } else {
          // Sigue pendiente
          members.push({ ...entry, source: 'classroom', pending: true });
        }
      }
    }
  }

  // Si hemos encontrado alumnos que ya estaban registrados, actualizamos la base de datos
  // (El profesor tiene permisos de escritura en su propia clase)
  if (needsHeal) {
    await updateDoc(doc(db, 'tic2_classes', classId), {
      members: newMembersArr,
      updatedAt: serverTimestamp()
    });
  }

  return members;
}

/** Añadir alumno al array members de la clase (importación Classroom) */
export async function addMemberToClass(classId, uid) {
  await updateDoc(doc(db, 'tic2_classes', classId), {
    members: arrayUnion(uid)
  });
}

/** Añadir alumno pendiente (sin cuenta) al array members */
export async function addPendingMember(classId, email, name) {
  await updateDoc(doc(db, 'tic2_classes', classId), {
    members: arrayUnion({ email, name, pending: true })
  });
}

// ══════════════════════════════════════════════════════════════════
//  TAREAS (Assignments)
// ══════════════════════════════════════════════════════════════════

export async function createAssignment(classId, data) {
  const ref = await addDoc(collection(db, 'tic2_classes', classId, 'tic2_assignments'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateAssignment(classId, assignmentId, data) {
  await updateDoc(doc(db, 'tic2_classes', classId, 'tic2_assignments', assignmentId), data);
}

export async function getClassAssignments(classId) {
  const snap = await getDocs(collection(db, 'tic2_classes', classId, 'tic2_assignments'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteAssignment(classId, assignmentId) {
  await deleteDoc(doc(db, 'tic2_classes', classId, 'tic2_assignments', assignmentId));
}

// ══════════════════════════════════════════════════════════════════
//  RESULTADOS DE JUEGOS
// ══════════════════════════════════════════════════════════════════

/**
 * Guarda el resultado de una partida.
 * @param {string} gameId       - 'mecanoclass' | 'rompecodigos' | 'helados' | 'moon'
 * @param {string} studentId    - UID del jugador
 * @param {string|null} classId - ID de la clase (o null si partida libre del profesor)
 * @param {number} score        - Puntuación principal
 * @param {object} metadata     - Datos específicos del juego (wpm, accuracy, etc.)
 */
export async function saveGameResult(gameId, studentId, classId, score, metadata = {}) {
  const resultData = {
    gameId,
    studentId,
    classId:   classId || null,
    score:     Number(score) || 0,
    metadata:  metadata || {},
    timestamp: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'tic2_game_results'), resultData);

  // También guardar en users/{uid}/games/ para historial rápido del perfil (con manejo seguro de fallos)
  try {
    await addDoc(collection(db, 'tic2_users', studentId, 'tic2_games'), {
      gameId,
      classId: classId || null,
      score: Number(score) || 0,
      timestamp: serverTimestamp()
    });
  } catch (subErr) {
    console.warn('No se pudo guardar en users/{uid}/games (no crítico):', subErr);
  }

  return ref.id;
}

export async function getStudentResults(studentId, limitN = 20) {
  const q = query(
    collection(db, 'tic2_game_results'),
    where('studentId', '==', studentId),
    orderBy('timestamp', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudentResultsByGame(studentId, gameId, limitN = 20) {
  const q = query(
    collection(db, 'tic2_game_results'),
    where('studentId', '==', studentId),
    where('gameId', '==', gameId),
    orderBy('timestamp', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Histórico completo de un alumno en una clase concreta (filtrado en cliente) */
export async function getStudentResultsInClass(studentId, classId, limitN = 50) {
  // Sin orderBy para evitar requerir índice compuesto. Se ordena en cliente.
  const q = query(
    collection(db, 'tic2_game_results'),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all
    .filter(r => r.classId === classId)
    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
    .slice(0, limitN);
}

export async function getClassResults(classId, gameId = null, limitN = 100) {
  // Siempre filtramos solo por classId+timestamp (índice ya creado).
  // El filtro por gameId se aplica en cliente para evitar un tercer índice compuesto.
  const q = query(
    collection(db, 'tic2_game_results'),
    where('classId', '==', classId),
    orderBy('timestamp', 'desc'),
    limit(gameId ? 500 : limitN)   // Si hay filtro por juego, traemos más para filtrar luego
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!gameId) return all.slice(0, limitN);
  return all.filter(r => r.gameId === gameId).slice(0, limitN);
}

/** Obtiene el mejor score de un alumno en un juego para una clase */
export async function getStudentBestScore(studentId, gameId, classId) {
  const q = query(
    collection(db, 'tic2_game_results'),
    where('studentId', '==', studentId),
    where('gameId', '==', gameId),
    where('classId', '==', classId),
    orderBy('score', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? 0 : snap.docs[0].data().score;
}

/** Ranking de la clase para un juego (mejor score por alumno) */
export async function getClassRanking(classId, gameId) {
  const results = await getClassResults(classId, gameId, 500);

  // Agrupa por alumno → mejor score
  const bestByStudent = {};
  for (const r of results) {
    if (!bestByStudent[r.studentId] || r.score > bestByStudent[r.studentId].score) {
      bestByStudent[r.studentId] = r;
    }
  }

  return Object.values(bestByStudent).sort((a, b) => b.score - a.score);
}

// ══════════════════════════════════════════════════════════════════
//  SESIONES EN VIVO (MecanoClass & RompeCodigos)
// ══════════════════════════════════════════════════════════════════

/** Crea una sesión en vivo. Devuelve el PIN (= ID del documento) */
export async function createLiveSession(hostId, gameId, data = {}) {
  const pin = generatePin();
  await setDoc(doc(db, 'tic2_live_sessions', pin), {
    hostId,
    gameId,
    pin,
    status:    'lobby',   // lobby | running | finished
    createdAt: serverTimestamp(),
    ...data
  });
  return pin;
}

export async function getLiveSession(pin) {
  const snap = await getDoc(doc(db, 'tic2_live_sessions', pin));
  return snap.exists() ? snap.data() : null;
}

export async function updateLiveSession(pin, data) {
  await updateDoc(doc(db, 'tic2_live_sessions', pin), data);
}

export function listenToLiveSession(pin, onChange) {
  return onSnapshot(doc(db, 'tic2_live_sessions', pin), snap => {
    if (snap.exists()) onChange(snap.data());
  });
}

/** Unirse a una sesión en vivo */
export async function joinLiveSession(pin, studentId, displayName) {
  const session = await getLiveSession(pin);
  if (!session) throw new Error('Sesión no encontrada.');
  if (session.status !== 'lobby') throw new Error('La sesión ya ha comenzado o finalizado.');

  await setDoc(doc(db, 'tic2_live_participants', `${pin}_${studentId}`), {
    sessionId:   pin,
    studentId,
    displayName: displayName || 'Jugador',
    score:       0,
    progress:    0,
    status:      'waiting',  // waiting | playing | finished
    joinedAt:    serverTimestamp()
  }, { merge: true });

  return session;
}

export async function updateLiveParticipant(pin, studentId, data) {
  await setDoc(doc(db, 'tic2_live_participants', `${pin}_${studentId}`), data, { merge: true });
}

export function listenToLiveParticipants(pin, onChange) {
  const q = query(collection(db, 'tic2_live_participants'), where('sessionId', '==', pin));
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => d.data()));
  });
}

export async function getHostLiveSessions(hostId, gameId) {
  const q = query(
    collection(db, 'tic2_live_sessions'),
    where('hostId', '==', hostId),
    where('gameId', '==', gameId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// ══════════════════════════════════════════════════════════════════
//  TEXTOS DE MECANOGRAFÍA (MecanoClass)
// ══════════════════════════════════════════════════════════════════

export async function getMecanoTexts(classId = null) {
  const pool = [];

  // Textos globales (colección global)
  const globalSnap = await getDocs(collection(db, 'tic2_texts'));
  const globalTexts = globalSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'global' }));

  if (!classId) return globalTexts;

  // Textos personalizados de la clase + filtro de deshabilitados
  const classDoc = await getDoc(doc(db, 'tic2_classes', classId));
  if (!classDoc.exists()) return globalTexts;

  const { customTexts = [], disabledGlobalTexts = [] } = classDoc.data();
  const disabledSet = new Set(disabledGlobalTexts);

  const filtered = globalTexts.filter(t => !disabledSet.has(t.id));
  return [...filtered, ...customTexts.map(t => ({ ...t, source: 'custom' }))];
}

export async function getRandomMecanoText(classId = null) {
  const texts = await getMecanoTexts(classId);
  if (texts.length === 0) return null;
  return texts[Math.floor(Math.random() * texts.length)];
}

export async function seedMecanoTexts(texts) {
  const batch = [];
  for (const item of texts) {
    batch.push(setDoc(doc(collection(db, 'tic2_texts')), item));
  }
  await Promise.all(batch);
}

// ══════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN GLOBAL
// ══════════════════════════════════════════════════════════════════

export async function getSiteSettings() {
  const snap = await getDoc(doc(db, 'tic2_settings', 'site'));
  return snap.exists() ? snap.data() : { siteUrl: window.location.origin };
}

export async function updateSiteSettings(data) {
  await setDoc(doc(db, 'tic2_settings', 'site'), data, { merge: true });
}

/** Resuelve el estado pendiente de un alumno en las clases */
export async function resolvePendingStudent(uid, email) {
  if (!uid || !email) return;
  email = email.toLowerCase().trim();

  try {
    const q = query(collection(db, 'tic2_classes'));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      const cls = d.data();
      if (!cls.members || !Array.isArray(cls.members)) continue;

      let modified = false;
      const newMembers = cls.members.filter(m => {
        if (m && typeof m === 'object' && m.pending) {
          const mEmail = (m.email || '').toLowerCase().trim();
          if (mEmail === email) {
            modified = true;
            return false; // Eliminar del nuevo array
          }
        }
        return true;
      });

      if (modified) {
        if (!newMembers.includes(uid)) {
          newMembers.push(uid);
        }
        await updateDoc(doc(db, 'tic2_classes', d.id), {
          members: newMembers,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.error('Error resolviendo estado pendiente:', err);
  }
}

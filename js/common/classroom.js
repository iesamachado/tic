// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — Google Classroom API (Integración unificada)
//  -----------------------------------------------------------------------
//  Todas las funciones requieren un access token válido.
//  Obtenerlo con loginAsTeacher() o refreshClassroomToken() de auth.js
// ═══════════════════════════════════════════════════════════════════════

import { db, doc, updateDoc, addDoc, collection, getDocs, getDoc, setDoc, arrayUnion } from './firebase-config.js';
import { findUserByEmail, addMemberToClass, addPendingMember, createAssignment, getClassMembers } from './db.js';
import { scoreToGrade } from './utils.js';

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';

// ──────────────────────────────────────────────────────────────────────
//  Helper para peticiones a la API
// ──────────────────────────────────────────────────────────────────────
async function classroomFetch(token, path, options = {}) {
  const res = await fetch(`${CLASSROOM_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      ...options.headers
    }
  });

  if (res.status === 401) {
    throw Object.assign(new Error('Token de Classroom expirado. Vuelve a iniciar sesión como docente.'), { code: 'CLASSROOM_TOKEN_EXPIRED' });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Error HTTP ${res.status}`;
    throw new Error(`Classroom API: ${msg}`);
  }

  return res.json();
}

// ──────────────────────────────────────────────────────────────────────
//  Obtener cursos activos del profesor
// ──────────────────────────────────────────────────────────────────────
export async function fetchClassroomCourses(token) {
  const data = await classroomFetch(token, '/courses?courseStates=ACTIVE');
  return data.courses || [];
}

// ──────────────────────────────────────────────────────────────────────
//  Importar alumnos de un curso a una clase de TIC2Hub
//  Devuelve { matched, pending }
// ──────────────────────────────────────────────────────────────────────
export async function importClassroomStudents(token, courseId, classId) {
  const data = await classroomFetch(token, `/courses/${courseId}/students`);
  const students = data.students || [];

  let matched = 0;
  let pending = 0;

  // Obtener el doc de la clase para no duplicar
  const classDoc = await getDoc(doc(db, 'tic2_classes', classId));
  const existingMembers = new Set((classDoc.data()?.members || [])
    .map(m => typeof m === 'string' ? m : m?.email)
    .filter(Boolean)
  );

  for (const student of students) {
    const email = student.profile?.emailAddress;
    const name  = student.profile?.name?.fullName || email;
    if (!email) continue;
    if (existingMembers.has(email)) continue;

    const userProfile = await findUserByEmail(email);
    if (userProfile) {
      await addMemberToClass(classId, userProfile.uid);
      existingMembers.add(email);
      matched++;
    } else {
      await addPendingMember(classId, email, name);
      existingMembers.add(email);
      pending++;
    }
    
    // Permitir el acceso al alumno
    await setDoc(doc(db, 'tic2_allowed_students', email.toLowerCase()), { allowed: true });
  }

  return { matched, pending };
}

// ──────────────────────────────────────────────────────────────────────
//  Crear una tarea (CourseWork) en Google Classroom
// ──────────────────────────────────────────────────────────────────────
export async function createClassroomAssignment(token, courseId, classId, {
  gameId,
  title,
  description,
  targetScore,
  dueDate = null,
  siteUrl = null,
  skipFirestore = false
}) {
  const base = siteUrl || window.location.origin;
  const gameUrl = `${base}/${gameId}/index.html?classId=${classId}`;

  // Rúbrica automática
  const rubric = buildRubric(targetScore);

  const body = {
    title:       `TIC2Hub - ${title}`,
    description: `${description || ''}\n\n${rubric}\n\n👉 Accede al juego aquí: ${gameUrl}`,
    workType:    'ASSIGNMENT',
    state:       'PUBLISHED',
    maxPoints:   10,
    ...(dueDate ? parseDueDate(dueDate) : {})
  };

  const coursework = await classroomFetch(token, `/courses/${courseId}/courseWork`, {
    method: 'POST',
    body:   JSON.stringify(body)
  });

  // Guardar en Firestore (solo si no es una publicación de tarea ya existente)
  if (!skipFirestore) {
    await createAssignment(classId, {
      gameId,
      title,
      targetScore: parseInt(targetScore) || 0,
      classroomCourseId:     courseId,
      classroomCourseWorkId: coursework.id,
      dueDate:               dueDate || null
    });
  }

  return coursework;
}

// ──────────────────────────────────────────────────────────────────────
//  Sincronizar notas desde TIC2Hub → Google Classroom
//  gameGradesFn(studentId): Promise<number> → puntuación del alumno
// ──────────────────────────────────────────────────────────────────────
export async function syncClassroomGrades(token, courseId, classId, assignmentId, { targetScore, gameId }) {
  // 1. Obtener miembros de la clase
  const members = await getClassMembers(classId);

  // 2. Roster de Classroom → mapa email → googleUserId
  const rosterData = await classroomFetch(token, `/courses/${courseId}/students`);
  const emailToGid = {};
  (rosterData.students || []).forEach(s => {
    if (s.profile?.emailAddress) {
      emailToGid[s.profile.emailAddress.toLowerCase()] = s.userId;
    }
  });

  // 3. Para cada miembro registrado, calcular nota y enviarla
  const { getStudentBestScore } = await import('./db.js');
  let syncCount = 0;

  for (const member of members) {
    if (member.pending) continue;
    const email = member.email?.toLowerCase();
    if (!email || !emailToGid[email]) continue;

    const googleUserId = emailToGid[email];
    const score = await getStudentBestScore(member.uid, gameId, classId);
    const grade = scoreToGrade(score, targetScore);

    try {
      // Buscar la entrega del alumno
      const subData = await classroomFetch(token,
        `/courses/${courseId}/courseWork/${assignmentId}/studentSubmissions?userId=${googleUserId}`
      );

      const submissions = subData.studentSubmissions || [];
      if (submissions.length === 0) continue;

      const subId = submissions[0].id;
      await classroomFetch(token,
        `/courses/${courseId}/courseWork/${assignmentId}/studentSubmissions/${subId}?updateMask=draftGrade,assignedGrade`,
        { method: 'PATCH', body: JSON.stringify({ draftGrade: grade, assignedGrade: grade }) }
      );
      syncCount++;
    } catch (err) {
      console.error(`Error sincronizando nota de ${email}:`, err);
    }
  }

  return syncCount;
}

// ──────────────────────────────────────────────────────────────────────
//  Helpers internos
// ──────────────────────────────────────────────────────────────────────

function buildRubric(targetScore) {
  let rubric = '📊 RÚBRICA DE EVALUACIÓN:\n';
  for (let grade = 10; grade >= 5; grade--) {
    const pts = Math.ceil(targetScore * (grade / 10));
    rubric += `• Nota ${grade}: ${pts} puntos\n`;
  }
  rubric += `• Suspenso: menos de ${Math.ceil(targetScore * 0.5)} puntos`;
  return rubric;
}

function parseDueDate(dateStr) {
  const d = new Date(dateStr);
  return {
    dueDate: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
    dueTime: { hours: d.getHours(), minutes: d.getMinutes() }
  };
}

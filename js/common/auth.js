// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — Auth (Autenticación unificada)
//  -----------------------------------------------------------------------
//  Gestiona:
//   - Login con Google (alumno o profesor)
//   - Login con email/contraseña
//   - Token de Google Classroom (solo para profesores)
//   - Guard de autenticación (requireAuth)
//   - Guard de acceso a juego (requireGameAccess)
//   - Estado global: currentUser, currentProfile, classroomToken
// ═══════════════════════════════════════════════════════════════════════

import { auth, db, googleProvider, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail, updateProfile, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, Timestamp, orderBy, limit
} from './firebase-config.js';
import { generateAvatar, generateTeacherAvatar, anonymizeName, getUrlParams, getAppUrl } from './utils.js';
import { isStudentInAnyClass, isTeacherAuthorized, SUPERADMIN_EMAIL, resolvePendingStudent } from './db.js';

export { SUPERADMIN_EMAIL };

// ──────────────────────────────────────────────────────────────────────
//  Estado global exportado
// ──────────────────────────────────────────────────────────────────────
export let currentUser    = null;
export let currentProfile = null;   // documento users/{uid}
export let classroomToken = null;   // access token Google Classroom (solo profesores)

// Scopes requeridos para acceder a la API de Google Classroom
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails'
];

/**
 * Comprueba si un usuario es administrador del sistema
 */
export function isAdmin(user = currentUser, profile = currentProfile) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL.toLowerCase()) return true;
  return profile?.role === 'admin';
}

// ──────────────────────────────────────────────────────────────────────
//  LOGIN — Google (Alumno)
// ──────────────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const email = (result.user.email || '').toLowerCase().trim();
  
  if (!email) {
    await signOut(auth);
    throw new Error('No se pudo obtener el correo de Google.');
  }

  // Verificar si está matriculado en alguna clase activa (allowed_students)
  const isAllowed = await isStudentInAnyClass(email);
  if (!isAllowed) {
    await signOut(auth);
    throw new Error(`Acceso denegado. El correo (${email}) no está registrado en ninguna clase activa. Pide a tu docente que te añada.`);
  }

  return result.user;
}

// ──────────────────────────────────────────────────────────────────────
//  LOGIN — Google con Classroom (Profesor / Admin)
// ──────────────────────────────────────────────────────────────────────
export async function loginAsTeacher() {
  const provider = new GoogleAuthProvider();
  CLASSROOM_SCOPES.forEach(s => provider.addScope(s));
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const email = (result.user.email || '').toLowerCase().trim();

  if (!email) {
    await signOut(auth);
    throw new Error('No se pudo obtener el correo de Google.');
  }

  // Verificar si el docente está expresamente autorizado o es Superadmin
  const teacherAuth = await isTeacherAuthorized(email);
  if (!teacherAuth) {
    await signOut(auth);
    throw new Error(`Acceso denegado. El correo docente (${email}) no está autorizado en la plataforma. Contacta con el administrador (${SUPERADMIN_EMAIL}) para solicitar acceso.`);
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  classroomToken = credential?.accessToken || null;

  const assignedRole = (email === SUPERADMIN_EMAIL.toLowerCase() || teacherAuth.role === 'admin') ? 'admin' : 'teacher';

  // Guardar/actualizar perfil en Firestore
  await setDoc(doc(db, 'tic2_users', result.user.uid), {
    email: email,
    role: assignedRole,
    displayName: result.user.displayName || email.split('@')[0],
    lastLogin: serverTimestamp()
  }, { merge: true });

  return result.user;
}


// ──────────────────────────────────────────────────────────────────────
//  Refresco manual del token Classroom (el profesor lo reautoriza)
// ──────────────────────────────────────────────────────────────────────
export async function refreshClassroomToken() {
  if (!currentUser) throw new Error('No hay sesión activa');
  const provider = new GoogleAuthProvider();
  CLASSROOM_SCOPES.forEach(s => provider.addScope(s));
  provider.setCustomParameters({ prompt: 'consent', login_hint: currentUser.email });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  classroomToken = credential?.accessToken || null;
  return classroomToken;
}

// ──────────────────────────────────────────────────────────────────────
//  LOGIN — Email / Contraseña
// ──────────────────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

// ──────────────────────────────────────────────────────────────────────
//  REGISTRO — Email / Contraseña (Alumno o Profesor)
// ──────────────────────────────────────────────────────────────────────
export async function registerWithEmail(email, password, displayName, role = 'student') {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  await _createOrUpdateProfile(user, role, displayName);
  return user;
}

// ──────────────────────────────────────────────────────────────────────
//  LOGOUT
// ──────────────────────────────────────────────────────────────────────
export async function logout() {
  classroomToken = null;
  await signOut(auth);
  window.location.href = getAppUrl('index.html');
}

// ──────────────────────────────────────────────────────────────────────
//  Reset de contraseña
// ──────────────────────────────────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ──────────────────────────────────────────────────────────────────────
//  Crear / actualizar perfil en Firestore
// ──────────────────────────────────────────────────────────────────────
async function _createOrUpdateProfile(user, role = null, providedName = null) {
  const ref  = doc(db, 'tic2_users', user.uid);
  const snap = await getDoc(ref);

  const cleanEmail = (user.email || '').toLowerCase().trim();
  const isSuperAdmin = cleanEmail === SUPERADMIN_EMAIL.toLowerCase();

  let assignedRole = role || 'student';
  if (isSuperAdmin) {
    assignedRole = 'admin';
  }

  const rawName = providedName || user.displayName || user.email?.split('@')[0] || 'Usuario';
  const isTeacher = assignedRole === 'teacher' || assignedRole === 'admin';
  const finalDisplayName = isTeacher ? rawName : anonymizeName(rawName);

  if (!snap.exists()) {
    // Primer registro → crear perfil completo
    await setDoc(ref, {
      uid:          user.uid,
      email:        user.email,
      displayName:  finalDisplayName,
      displayNameAnonymized: anonymizeName(rawName),
      photoURL:     isTeacher
                      ? generateTeacherAvatar(user.uid)
                      : generateAvatar(user.uid),
      role:         assignedRole,
      createdAt:    serverTimestamp(),
      lastLogin:    serverTimestamp()
    });

    if (user.displayName !== finalDisplayName) {
      await updateProfile(user, { displayName: finalDisplayName });
    }

    return { role: assignedRole, email: user.email, displayName: finalDisplayName };
  } else {
    // Actualizar lastLogin y rol si es superadmin
    const updates = { lastLogin: serverTimestamp() };
    if (isSuperAdmin && snap.data()?.role !== 'admin') {
      updates.role = 'admin';
    }
    await setDoc(ref, updates, { merge: true });
    return { ...snap.data(), ...updates };
  }
}

// ──────────────────────────────────────────────────────────────────────
//  Actualizar datos del perfil
// ──────────────────────────────────────────────────────────────────────
/** Actualiza datos del perfil (nombre, avatar) en Auth y Firestore */
export async function updateUserProfileData(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario activo.");

  const authData = {};
  if (data.displayName !== undefined) authData.displayName = data.displayName;
  if (data.photoURL !== undefined) authData.photoURL = data.photoURL;

  if (Object.keys(authData).length > 0) {
    await updateProfile(user, authData);
  }

  await updateDoc(doc(db, 'tic2_users', user.uid), {
    ...authData,
    updatedAt: serverTimestamp()
  });

  if (authData.displayName) currentProfile.displayName = authData.displayName;
  if (authData.photoURL) currentProfile.photoURL = authData.photoURL;
}

// ──────────────────────────────────────────────────────────────────────
//  LISTENER principal — onAuthStateChanged
//  callback(user, profile) | callback(null, null)
// ──────────────────────────────────────────────────────────────────────
export function setupAuthListener(callback) {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      const ref  = doc(db, 'tic2_users', user.uid);
      try {
        const snap = await getDoc(ref);

        if (snap.exists()) {
          currentProfile = snap.data();
          // Asegurar superadmin
          if (user.email?.toLowerCase().trim() === SUPERADMIN_EMAIL.toLowerCase() && currentProfile.role !== 'admin') {
            currentProfile.role = 'admin';
          }
        } else {
          // Usuario nuevo sin rol definido (login Google alumno por primera vez)
          currentProfile = await _createOrUpdateProfile(user, 'student');
        }

        // Resolver pendientes si es alumno y no se ha resuelto antes
        if (currentProfile?.role === 'student' && !currentProfile.resolvedPending) {
          await resolvePendingStudent(user.uid, user.email);
          await updateDoc(ref, { resolvedPending: true });
          currentProfile.resolvedPending = true;
        }

        callback(user, currentProfile);
      } catch (error) {
        console.warn("No se pudo obtener el perfil de usuario (puede que la sesión se haya cerrado):", error);
      }
    } else {
      currentUser    = null;
      currentProfile = null;
      classroomToken = null;
      callback(null, null);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
//  GUARD — Requiere autenticación
//  Opciones:
//    allowedRoles: ['teacher'] | ['student'] | ['admin'] | ['teacher','student'] (por defecto teacher y student)
//    onAuthorized(user, profile): callback si autorizado
//    redirectTo: URL a la que redirigir si no autenticado (por defecto raíz)
// ──────────────────────────────────────────────────────────────────────
export function requireAuth({ allowedRoles = ['teacher', 'student'], onAuthorized, redirectTo } = {}) {
  const loginPage = redirectTo || getAppUrl('index.html');

  return setupAuthListener(async (user, profile) => {
    if (!user || !profile) {
      // Guardar la URL actual para volver después del login
      sessionStorage.setItem('tic2hub_redirect', window.location.href);
      window.location.href = loginPage;
      return;
    }

    const userIsAdmin = isAdmin(user, profile);
    const hasRole = allowedRoles.includes(profile.role) ||
                    (allowedRoles.includes('teacher') && userIsAdmin) ||
                    (allowedRoles.includes('admin') && userIsAdmin);

    if (!hasRole) {
      // Redirigir al dashboard correspondiente
      if (profile.role === 'teacher' || userIsAdmin) {
        window.location.href = getAppUrl('dashboard_teacher.html');
      } else {
        window.location.href = getAppUrl('dashboard_student.html');
      }
      return;
    }

    if (profile.role === 'student' && onAuthorized) {
      const path = window.location.pathname.toLowerCase();
      const isGameOrTest = path.includes('/cc_trivial/') || 
                           path.includes('/cert_arcade/') || 
                           path.includes('/databreach/') || 
                           path.includes('/hex_invaders/') || 
                           path.includes('/kanban_hero/') || 
                           path.endsWith('examen.html') || 
                           path.endsWith('test.html');
                           
      if (isGameOrTest) {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Identify what we are accessing
        let targetId = null;
        let type = null; // 'game', 'theory', 'examen'
        
        if (path.includes('/cc_trivial/')) { targetId = 'cc_trivial'; type = 'game'; }
        else if (path.includes('/cert_arcade/')) { targetId = 'cert_arcade'; type = 'game'; }
        else if (path.includes('/databreach/')) { targetId = 'databreach'; type = 'game'; }
        else if (path.includes('/hex_invaders/')) { targetId = 'hex_invaders'; type = 'game'; }
        else if (path.includes('/kanban_hero/')) { targetId = 'kanban_hero'; type = 'game'; }
        else if (path.endsWith('test.html')) {
            const file = getUrlParams().file;
            const topicMap = {
              'multimedia.html': 'topic_multimedia', 'cms.html': 'topic_cms',
              'html.html': 'topic_html', 'js.html': 'topic_js',
              'cyber.html': 'topic_cyber', 'kanban.html': 'topic_kanban',
              'drive.html': 'topic_drive', 'js_advanced.html': 'topic_js_adv'
            };
            targetId = topicMap[file];
            type = 'theory';
        }
        else if (path.endsWith('examen.html')) {
            targetId = getUrlParams().id;
            type = 'examen';
        }

        if (targetId && type) {
          try {
            let playCount = 0;
            
            if (type === 'game') {
              const qGames = query(collection(db, 'tic2_game_results'), where('studentId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50));
              const snapGames = await getDocs(qGames);
              snapGames.forEach(doc => {
                const d = doc.data();
                if (d.timestamp?.toDate() >= today && d.gameId === targetId) playCount++;
              });
            }
            
            if (type === 'theory') {
              const qTheory = query(collection(db, 'tic2_tests_teoria'), where('uid', '==', user.uid));
              const snapTheory = await getDocs(qTheory);
              snapTheory.forEach(doc => {
                const d = doc.data();
                if (d.fecha?.toDate() >= today && d.topicKey === targetId) playCount++;
              });
            }
            
            if (type === 'examen') {
              const qExams = query(collection(db, 'respuestas_test'), where('uid', '==', user.uid));
              const snapExams = await getDocs(qExams);
              snapExams.forEach(doc => {
                const d = doc.data();
                if (d.timestamp?.toDate() >= today && d.examenId === targetId) playCount++;
              });
            }

            if (playCount >= 5) {
              document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#f4f6f7; font-family:system-ui,sans-serif; text-align:center; padding:20px;">
                  <div style="font-size:5rem; margin-bottom:20px;">🌱</div>
                  <h1 style="color:#2c3e50; font-size:2.5rem; margin-bottom:15px;">Límite Diario Alcanzado</h1>
                  <div style="background:#fff; border-top:4px solid #3498db; padding:30px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.1); max-width:600px; line-height:1.6; font-size:1.1rem; color:#34495e;">
                    <p>Has alcanzado el límite de <strong>5 intentos</strong> por hoy para esta actividad.</p>
                    <p>En nuestra clase valoramos tu <strong>Bienestar Digital</strong>. El uso excesivo de pantallas puede causar fatiga visual, sedentarismo y afectar a tu calidad de sueño. No hace falta que estés toda la tarde enganchado/a a un mismo juego o test para conseguir experiencia.</p>
                    <p>Te recomendamos que apagues la pantalla, salgas a dar un paseo, leas un libro o interactúes fuera del mundo digital.</p>
                    <p style="margin-top:25px; font-weight:bold;">¡Mañana podrás volver a intentarlo!</p>
                    <a href="${getAppUrl('dashboard_student.html')}" style="display:inline-block; margin-top:20px; background:#3498db; color:white; padding:12px 25px; text-decoration:none; border-radius:50px; font-weight:bold;">Volver al Panel Principal</a>
                  </div>
                </div>
              `;
              return; // Do not authorize
            }
          } catch(e) {
            console.error("Error verificando límite de bienestar digital:", e);
          }
        }
      }
    }

    if (onAuthorized) onAuthorized(user, profile);
  });
}

// ──────────────────────────────────────────────────────────────────────
//  GUARD — Requiere acceso al juego
//  Verifica que el usuario tenga una clase con el juego habilitado.
//  Los profesores y administradores siempre tienen acceso.
//  onGranted(user, profile, classId): se llama con el classId de la sesión
// ──────────────────────────────────────────────────────────────────────
export function requireGameAccess(gameId, { onGranted } = {}) {
  return requireAuth({
    allowedRoles: ['teacher', 'student', 'admin'],
    onAuthorized: async (user, profile) => {
      const { classId } = getUrlParams();

      // Los profesores y administradores siempre tienen acceso
      if (profile.role === 'teacher' || isAdmin(user, profile)) {
        if (onGranted) onGranted(user, profile, classId || null);
        return;
      }

      // Alumnos: verificar que tienen al menos una clase con el juego habilitado
      const { getStudentClasses } = await import('./db.js');
      const classes = await getStudentClasses(user.uid);
      const eligible = classes.filter(c =>
        Array.isArray(c.enabledGames) && c.enabledGames.includes(gameId)
      );

      if (eligible.length === 0) {
        // Sin acceso → al dashboard con mensaje
        sessionStorage.setItem('tic2hub_no_access_game', gameId);
        window.location.href = `${getAppUrl('dashboard_student.html')}?noAccess=${gameId}`;
        return;
      }

      // Si viene classId en URL, verificar que es una de las elegibles
      let resolvedClassId = classId;
      if (classId && !eligible.find(c => c.id === classId)) {
        resolvedClassId = eligible[0].id;
      } else if (!classId) {
        resolvedClassId = eligible[0].id;
      }

      if (onGranted) onGranted(user, profile, resolvedClassId);
    }
  });
}

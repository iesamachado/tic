import { requireAuth } from '../js/common/auth.js';
import { addPointsAndCheckLogros, awardMedal } from '../js/common/gamification.js';
import { db } from '../js/common/db.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { renderHeader, showToast, showModal } from '../js/common/ui.js';

const topicMap = {
  'multimedia.html': { topicKey: 'topic_multimedia', title: 'Edición Multimedia', medalId: 'experto_multimedia', goldMedalId: 'experto_multimedia_oro' },
  'cms.html': { topicKey: 'topic_cms', title: 'CMS y SEO', medalId: 'maestro_cms', goldMedalId: 'maestro_cms_oro' },
  'html.html': { topicKey: 'topic_html', title: 'HTML', medalId: 'dev_web', goldMedalId: 'dev_web_oro' },
  'js.html': { topicKey: 'topic_js', title: 'Javascript', medalId: 'dev_web', goldMedalId: 'dev_web_oro' },
  'cyber.html': { topicKey: 'topic_cyber', title: 'Ciberseguridad', medalId: 'sysadmin', goldMedalId: 'sysadmin_oro' },
  'kanban.html': { topicKey: 'topic_kanban', title: 'Industria del Software', medalId: 'kanban_master', goldMedalId: 'kanban_master_oro' },
  'drive.html': { topicKey: 'topic_drive', title: 'Ofimática Colaborativa', medalId: 'raton_biblioteca', goldMedalId: 'raton_biblioteca' } // fallback
};

const urlParams = new URLSearchParams(window.location.search);
const filename = urlParams.get('file');
const tData = topicMap[filename];

let questions = [];
let answers = []; // store selected option index (or -1 for blank)
let currentQ = 0;
let currentUser = null;
let currentProfile = null;
let testActive = false;
let blurWarnings = 0;

requireAuth({
  allowedRoles: ['student', 'teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    currentUser = user;
    currentProfile = profile;
    
    if (!tData) {
      document.getElementById('loading-view').innerHTML = '<div style="text-align:center;margin-top:100px;"><h2>Error</h2><p>No se especificó un tema válido.</p><button class="btn btn-primary" onclick="window.location.href=\'../index.html\'">Volver</button></div>';
      return;
    }

    try {
      const q = query(collection(db, "preguntas"), where("topic", "==", tData.topicKey));
      let snap = await getDocs(q);
      
      let allQ = snap.docs.map(d => ({id: d.id, ...d.data()}));
      if (allQ.length === 0) {
        document.getElementById('loading-view').innerHTML = '<div style="text-align:center;margin-top:100px;"><h2>Error</h2><p>No hay suficientes preguntas para este bloque.</p><button class="btn btn-primary" onclick="window.history.back()">Volver</button></div>';
        return;
      }

      allQ.sort(() => 0.5 - Math.random());
      questions = allQ.slice(0, 10);
      answers = new Array(questions.length).fill(null);
      
      document.getElementById('loading-view').style.display = 'none';
      document.getElementById('test-view').style.display = 'flex';
      testActive = true;
      
      renderQuestion();
      setupEvents();
    } catch (err) {
      console.error(err);
      showToast('Error de conexión', 'error');
    }
  }
});


window.goToQuestion = function(idx) {
  currentQ = idx;
  renderQuestion();
};

function renderNavigator() {
  const nav = document.getElementById('q-navigator');
  if (!nav) return;
  
  let html = '';
  questions.forEach((q, idx) => {
    let classes = ['nav-btn'];
    if (idx === currentQ) classes.push('current');
    
    if (answers[idx] === -1) {
      classes.push('blank');
    } else if (answers[idx] !== null && answers[idx] !== undefined) {
      classes.push('answered');
    }

    html += `<div class="${classes.join(' ')}" onclick="window.goToQuestion(${idx})">${idx + 1}</div>`;
  });
  nav.innerHTML = html;
}

function renderQuestion() {
  const q = questions[currentQ];
  const qCard = document.getElementById('q-card');
  const counter = document.getElementById('q-counter');
  const fill = document.getElementById('progress-fill');
  
  counter.textContent = `Pregunta ${currentQ + 1} de ${questions.length}`;
  fill.style.width = `${((currentQ) / questions.length) * 100}%`;
  
  let html = `<h2 style="color: var(--accent); margin-bottom: 25px; font-size: 1.5rem; line-height: 1.4;">${q.enunciado.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>`;
  
  if (q.opciones) {
    q.opciones.forEach((op, idx) => {
      const isSelected = answers[currentQ] === idx;
      html += `
        <label class="option-label ${isSelected ? 'selected' : ''}">
          <input type="radio" name="q_opt" value="${idx}" ${isSelected ? 'checked' : ''} style="display: none;">
          <div style="display: flex; align-items: center;">
            <div style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${isSelected ? 'var(--accent)' : '#bdc3c7'}; margin-right: 15px; display: flex; align-items: center; justify-content: center; background: ${isSelected ? 'var(--accent)' : 'transparent'};">
              ${isSelected ? '<span style="color:white; font-size:12px;">✓</span>' : ''}
            </div>
            <div style="flex: 1;">${op.texto.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        </label>
      `;
    });
  }
  
  const isBlank = answers[currentQ] === -1;
  html += `
    <label class="option-label ${isBlank ? 'selected' : ''}" style="margin-top: 30px; border-style: dashed;">
      <input type="radio" name="q_opt" value="-1" ${isBlank ? 'checked' : ''} style="display: none;">
      <div style="display: flex; align-items: center;">
        <div style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${isBlank ? 'var(--accent)' : '#bdc3c7'}; margin-right: 15px; display: flex; align-items: center; justify-content: center; background: ${isBlank ? 'var(--accent)' : 'transparent'};">
          ${isBlank ? '<span style="color:white; font-size:12px;">✓</span>' : ''}
        </div>
        <div style="flex: 1; font-style: italic; color: #7f8c8d;">Dejar en blanco (0 pts)</div>
      </div>
    </label>
  `;
  
  qCard.innerHTML = html;
  
  // Re-bind option clicks
  document.querySelectorAll('input[name="q_opt"]').forEach(rad => {
    rad.addEventListener('change', (e) => {
      answers[currentQ] = parseInt(e.target.value);
      renderQuestion(); // re-render to update selected styles
    });
  });
  
  // Update buttons
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  btnPrev.style.visibility = currentQ > 0 ? 'visible' : 'hidden';
  
  if (currentQ === questions.length - 1) {
    btnNext.textContent = 'Entregar Test ✔️';
    btnNext.classList.remove('btn-primary');
    btnNext.classList.add('btn-success');
    btnNext.style.background = '#27ae60';
  } else {
    btnNext.textContent = 'Siguiente ➡';
    btnNext.classList.add('btn-primary');
    btnNext.classList.remove('btn-success');
    btnNext.style.background = '';
  }
  renderNavigator();
}

function setupEvents() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentQ > 0) {
      currentQ--;
      renderQuestion();
    }
  });
  
  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentQ < questions.length - 1) {
      currentQ++;
      renderQuestion();
    } else {
      submitTest();
    }
  });
  
  document.getElementById('btn-exit').addEventListener('click', () => {
    showModal({
      title: 'Salir sin guardar',
      body: '¿Seguro que quieres salir? Perderás el progreso de este test.',
      confirmText: 'Salir',
      onConfirm: () => {
        window.location.href = filename;
      }
    });
  });
}

function submitTest() {
  if (!testActive) return;
  showModal({
    title: 'Entregar Test',
    body: '¿Estás seguro de entregar el test? Se evaluarán tus respuestas y no podrás repetirlo.',
    confirmText: 'Entregar',
    onConfirm: async () => {
      document.getElementById('test-view').style.display = 'none';
      await processSubmission();
    }
  });
}

async function processSubmission(forcedFail = false) {
  testActive = false;
  document.getElementById('loading-view').style.display = 'flex';
  document.getElementById('loading-view').innerHTML = '<div style="text-align:center;margin-top:100px;"><h2>Evaluando...</h2></div>';
  
  let score = 0;
  let respuestas = [];

  questions.forEach((q, idx) => {
    let answered = answers[idx];
    if (answered === null || answered === undefined) answered = -1; // Treat untouched as blank
    let isCorrect = false;
    
    if (answered !== -1) {
      if (q.opciones[answered].correcta) {
        score += 1;
        isCorrect = true;
      } else {
        score -= 0.33;
      }
    }
    
    respuestas.push({
      preguntaId: q.id,
      enunciado: q.enunciado,
      marcada: answered !== -1 ? q.opciones[answered].texto : 'BLANCO',
      correctaTexto: q.opciones.find(o => o.correcta)?.texto || '?',
      isCorrect: isCorrect,
      isBlanco: answered === -1
    });
  });

  const totalPossible = questions.length;
  let finalScore = (score / totalPossible) * 10;
  if (finalScore < 0) finalScore = 0;
  finalScore = Math.round(finalScore * 100) / 100;
  if (forcedFail) finalScore = 0;

  // Save to DB
  if (currentProfile.role === 'student') {
    try {
      let xp = 0;
      if (finalScore >= 3) {
        xp = finalScore >= 5 ? Math.round(finalScore * 10) : 5;
      }

      if (xp > 0) {
        const res = await addPointsAndCheckLogros(currentUser.uid, xp, null, 'tic2_users');
        if (finalScore >= 5) {
          await awardMedal(currentUser.uid, 'raton_biblioteca', 'tic2_users');
          await awardMedal(currentUser.uid, tData.medalId, 'tic2_users');
        }
        if (finalScore >= 9) {
          await awardMedal(currentUser.uid, tData.goldMedalId, 'tic2_users');
        }
        
        if (res && res.leagueUp) {
          showToast("¡Nueva Liga Desbloqueada!", `Has ascendido a la ${res.newLeague.name}`, "success", 5000);
        }
      }
    } catch(err) {
      console.error('Error awarding medals:', err);
    }
  }

  try {
    await addDoc(collection(db, 'tic2_tests_teoria'), {
      uid: currentUser.uid,
      alumnoNombre: currentProfile.displayName || currentProfile.email,
      topicKey: tData.topicKey,
      topicTitle: tData.title,
      score: finalScore,
      rawScore: score,
      maxPossible: totalPossible,
      respuestas: respuestas,
      fecha: serverTimestamp()
    });
  } catch (err) {
    console.error('Error saving test results:', err);
  }

  // Show results
  document.getElementById('loading-view').style.display = 'none';
  document.getElementById('results-view').style.display = 'flex';
  
  const resultsContent = document.getElementById('results-content');
  resultsContent.innerHTML = `
    <h2 style="margin-bottom: 20px; font-size: 2rem;">Resultados del Test</h2>
    <div style="font-size: 6rem; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">${finalScore >= 5 ? '🎉' : '💀'}</div>
    <h1 style="color: ${finalScore >= 5 ? 'var(--success)' : 'var(--danger)'}; font-size: 4rem; margin-bottom: 20px;">
      ${finalScore} <span style="font-size: 2rem; color: #7f8c8d;">/ 10</span>
    </h1>
    <p style="font-size: 1.3rem; margin-bottom: 30px; color: #555;">
      ${finalScore >= 5 
        ? '¡Enhorabuena! Has aprobado el test. Tus resultados han sido enviados a tu profesor.' 
        : 'Has suspendido. Repasa el temario y vuelve a intentarlo más tarde.'}
    </p>
    ${finalScore >= 9 ? '<p style="color: #f1c40f; font-weight: bold; font-size: 1.4rem; margin-bottom: 30px; background: #fffdf0; display: inline-block; padding: 10px 20px; border-radius: 8px; border: 1px solid #f1c40f;">¡Sobresaliente! Se te ha otorgado una Medalla de Oro 🥇</p><br>' : ''}
    <button class="btn btn-primary btn--lg" onclick="window.location.href='${filename}'">⬅ Volver al Temario</button>
  `;
}


// --- Sistema Anti-Chuletas (Control de Foco) ---
function handleFocusLost() {
  if (!testActive) return; // Si no hay test activo (cargando o ya terminado), no pasa nada
  if (currentProfile && currentProfile.role !== 'student') return; // Profesores no tienen restricción
  
  blurWarnings++;
  
  if (blurWarnings === 1) {
    showModal({
      title: '⚠️ ¡Atención! Actividad sospechosa',
      body: 'Hemos detectado que has salido de la ventana o cambiado de pestaña. Durante el test no está permitido consultar otras fuentes.<br><br><b>Si vuelves a salir, el test se suspenderá automáticamente con un 0.</b>',
      confirmText: 'Entendido, continuaré el test',
      onConfirm: () => {}
    });
  } else if (blurWarnings >= 2) {
    // Auto fail and redirect home
    testActive = false; // Parar de contar
    showModal({
      title: '❌ Test Suspendido',
      body: 'Has vuelto a salir de la ventana. Las reglas del examen son estrictas: el test ha sido anulado con un 0 automático.',
      confirmText: 'Volver a Inicio',
      hideCancel: true,
      onConfirm: async () => {
        // Enviar silenciosamente
        let score = 0;
        let respuestas = questions.map(q => ({
          preguntaId: q.id,
          enunciado: q.enunciado,
          marcada: 'BLANCO',
          correctaTexto: q.opciones.find(o => o.correcta)?.texto || '?',
          isCorrect: false,
          isBlanco: true
        }));
        
        try {
          await addDoc(collection(db, 'tic2_tests_teoria'), {
            uid: currentUser.uid,
            alumnoNombre: currentProfile.displayName || currentProfile.email,
            topicKey: tData.topicKey,
            topicTitle: tData.title,
            score: 0,
            rawScore: 0,
            maxPossible: questions.length,
            respuestas: respuestas,
            fecha: serverTimestamp()
          });
        } catch(e) {}
        
        window.location.href = '../index.html';
      }
    });
  }
}

window.addEventListener('blur', handleFocusLost);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') handleFocusLost();
});

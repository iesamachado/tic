import { LEVELS } from './levels.js';
import { showToast } from '../../js/common/ui.js';
import { requireAuth } from '../../js/common/auth.js';
import { saveGameResult } from '../../js/common/db.js';
import { escapeHtml, getUrlParams } from '../../js/common/utils.js';
import { addPointsAndCheckLogros, awardMedal } from '../../js/common/gamification.js';

let currentUser = null;
let classId = null;
let currentLevelIndex = 0;

// Elementos UI
const ui = {
  userDisplay: document.getElementById('user-display'),
  levelDisplay: document.getElementById('level-display'),
  missionText: document.getElementById('mission-text'),
  schemaViewer: document.getElementById('schema-viewer'),
  queryOutput: document.getElementById('query-output'),
  sqlInput: document.getElementById('sql-input'),
  btnExecute: document.getElementById('btn-execute'),
  btnReset: document.getElementById('btn-reset'),
  btnQuit: document.getElementById('btn-quit'),
  
  modalSuccess: document.getElementById('modal-success'),
  btnNextLevel: document.getElementById('btn-next-level'),
  successMsg: document.getElementById('success-msg'),
  
  modalFinish: document.getElementById('modal-finish'),
  btnFinish: document.getElementById('btn-finish')
};

// ── INIT ──────────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    currentUser = user;
    classId = getUrlParams().classId;
    
    ui.userDisplay.textContent = profile.displayNameAnonymized || profile.displayName || user.email;
    
    setupEventListeners();
    loadLevel(0);
  }
});

function setupEventListeners() {
  ui.btnExecute.addEventListener('click', executeQuery);
  ui.sqlInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      executeQuery();
    }
  });
  
  ui.btnReset.addEventListener('click', () => {
    logOutput("Reiniciando base de datos...", false);
    loadLevel(currentLevelIndex);
  });
  
  ui.btnNextLevel.addEventListener('click', () => {
    ui.modalSuccess.style.display = 'none';
    currentLevelIndex++;
    if (currentLevelIndex < LEVELS.length) {
      loadLevel(currentLevelIndex);
    }
  });
  
  ui.btnFinish.addEventListener('click', () => {
    window.location.href = '../dashboard_student.html';
  });
  
  ui.btnQuit.addEventListener('click', () => {
    window.location.href = '../dashboard_student.html';
  });
}

// ── LOGICA DE NIVELES ──────────────────────────────────────────────
function loadLevel(index) {
  const level = LEVELS[index];
  ui.levelDisplay.textContent = level.id;
  ui.missionText.innerHTML = level.missionText;
  
  // Limpiar input y output
  ui.sqlInput.value = '';
  if (level.isInjectionLevel) {
    ui.sqlInput.placeholder = "Ejemplo de input: password' OR '1'='1";
  } else {
    ui.sqlInput.placeholder = "Escribe tu consulta SQL aquí y presiona Ctrl+Enter para ejecutar...";
  }
  
  // Reiniciar AlaSQL Database
  alasql('DROP DATABASE IF EXISTS databreach; CREATE DATABASE databreach; USE databreach;');
  
  // Ejecutar queries de setup
  level.setupSQL.forEach(q => alasql(q));
  
  renderSchema(level.schema);
  
  ui.queryOutput.innerHTML = `
    <div class="db-welcome">
      <div>[SISTEMA] Nivel ${level.id} cargado.</div>
      <div>[SISTEMA] Base de datos en memoria lista.</div>
    </div>
  `;
}

function renderSchema(schema) {
  ui.schemaViewer.innerHTML = schema.map(t => `
    <div class="db-table-schema">
      <div class="db-table-name"><i class="fas fa-table"></i> ${escapeHtml(t.table)}</div>
      <div class="db-table-cols">
        ${t.cols.map(c => `
          <div class="db-col-row">
            <span>${escapeHtml(c.name)}</span>
            <span class="db-col-type">[${c.type}]</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── EJECUCIÓN ──────────────────────────────────────────────────────
function executeQuery() {
  const level = LEVELS[currentLevelIndex];
  let input = ui.sqlInput.value.trim();
  if (!input) return;
  
  let finalQuery = input;
  
  // Si es nivel de inyección, envolvemos el input
  if (level.isInjectionLevel) {
    finalQuery = `SELECT * FROM usuarios WHERE username = 'admin' AND password = '${input}'`;
    logOutput(finalQuery, false);
  } else {
    logOutput(input, false);
  }
  
  try {
    const res = alasql(finalQuery);
    
    // Mostrar resultados
    renderResultTable(res);
    
    // Validar si resolvió el nivel
    if (level.validate(res)) {
      handleLevelComplete(level);
    }
  } catch (err) {
    logError(err.message);
  }
}

function renderResultTable(res) {
  if (!res || !Array.isArray(res)) {
    logOutput(`Resultado: ${JSON.stringify(res)}`, false);
    return;
  }
  
  if (res.length === 0) {
    logOutput("0 filas devueltas.", false);
    return;
  }
  
  const cols = Object.keys(res[0]);
  let html = `<table class="db-result-table">
    <thead>
      <tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${res.map(row => `
        <tr>${cols.map(c => `<td>${escapeHtml(String(row[c]))}</td>`).join('')}</tr>
      `).join('')}
    </tbody>
  </table>
  <div style="margin-top:5px; color:#94a3b8; font-size:0.8rem;">${res.length} filas devueltas.</div>`;
  
  appendHtmlToOutput(html);
}

function logOutput(text, isError = false) {
  const div = document.createElement('div');
  div.className = 'query-log';
  if (isError) {
    div.innerHTML = `<div class="query-log-error"><i class="fas fa-times-circle"></i> ERROR: ${escapeHtml(text)}</div>`;
  } else {
    div.innerHTML = `<div class="query-log-cmd">${escapeHtml(text)}</div>`;
  }
  ui.queryOutput.appendChild(div);
  ui.queryOutput.scrollTop = ui.queryOutput.scrollHeight;
}

function logError(errStr) {
  logOutput(errStr, true);
}

function appendHtmlToOutput(html) {
  const div = document.createElement('div');
  div.className = 'query-log';
  div.innerHTML = html;
  ui.queryOutput.appendChild(div);
  ui.queryOutput.scrollTop = ui.queryOutput.scrollHeight;
}

// ── VICTORIA ───────────────────────────────────────────────────────
async function handleLevelComplete(level) {
  ui.successMsg.textContent = level.successMsg;
  ui.modalSuccess.style.display = 'flex';
  
  // Si es el último nivel, terminar juego
  if (currentLevelIndex === LEVELS.length - 1) {
    ui.modalSuccess.style.display = 'none';
    ui.modalFinish.style.display = 'flex';
    
    // Guardar puntuación en DB
    try {
      if (classId) {
        await saveGameResult(currentUser.uid, 'databreach', classId, 100, {});
      }
      // Gamificación
      const result = await addPointsAndCheckLogros(currentUser.uid, 100);
      await awardMedal(currentUser.uid, 'hacker_novato');
      await awardMedal(currentUser.uid, 'first_blood'); // Quizás sea su primer reto
      
      if (result.leagueUp) {
        showToast('¡Nueva Liga Desbloqueada!', `¡Has ascendido a la ${result.newLeague.name} ${result.newLeague.icon}!`, 'success', 5000);
      }
    } catch(e) {
      console.error("Error guardando score", e);
    }
  }
}

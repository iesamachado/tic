import { requireAuth } from '../../js/common/auth.js';
import { addPointsAndCheckLogros, awardMedal } from '../../js/common/gamification.js';
import { showToast } from '../../js/common/ui.js';
import { $, getUrlParams } from '../../js/common/utils.js';
import { saveGameResult } from '../../js/common/db.js';

let currentUser = null;
let currentProfile = null;
let classId = null;

// Configuración del Juego
const GAME_TIME = 60;
const WIP_LIMIT = 3;
const TODO_LIMIT = 6;
const TESTING_WIP_LIMIT = 2;
const POINTS_PER_TASK = 15;

// Estado del Juego
let score = 0;
let timeLeft = GAME_TIME;
let isPlaying = false;
let gameLoopInterval = null;
let spawnerInterval = null;
let taskIdCounter = 0;
let tickCounter = 0;
let tasksData = {}; // { id: { progress: 0, required: 100, isReady: false } }

// DOM Elements
const zoneTodo = $('zone-todo');
const zoneDoing = $('zone-doing');
const zoneDone = $('zone-done');
const zoneTesting = $('zone-testing');
const scoreDisplay = $('score-display');
const timerDisplay = $('timer-display');
const todoCountDisplay = $('todo-count-display');

// Tareas posibles
const taskTemplates = [
  { title: "Diseñar Base de Datos", desc: "Crear esquema ER y tablas SQL." },
  { title: "Autenticación", desc: "Implementar login con Google." },
  { title: "Interfaz CSS", desc: "Maquetar la página principal." },
  { title: "API REST", desc: "Crear endpoints para usuarios." },
  { title: "Testing", desc: "Escribir pruebas unitarias." },
  { title: "Despliegue", desc: "Subir la web a Firebase Hosting." },
  { title: "Bug Fix #42", desc: "El botón no funciona en móviles." },
  { title: "Optimización", desc: "Reducir tamaño de las imágenes." },
  { title: "Doc. Usuario", desc: "Escribir manual de ayuda." },
  { title: "Setup Inicial", desc: "Configurar repositorio Git." }
];

requireAuth({
  allowedRoles: ['student', 'teacher', 'admin'],
  onAuthorized: (user, profile) => {
    currentUser = user;
    currentProfile = profile;
    classId = getUrlParams().classId || null;
    $('btn-start').addEventListener('click', startGame);
  }
});

function startGame() {
  $('start-screen').style.display = 'none';
  
  score = 0;
  timeLeft = GAME_TIME;
  isPlaying = true;
  taskIdCounter = 0;
  tickCounter = 0;
  tasksData = {};
  
  zoneTodo.innerHTML = '';
  zoneDoing.innerHTML = '';
  zoneDone.innerHTML = '';
  zoneTesting.innerHTML = '';
  updateHUD();

  // Spawner inicial
  spawnTask();
  spawnTask();

  // Iniciar bucles
  spawnerInterval = setInterval(spawnTask, 4000); // Tarea nueva cada 4s
  gameLoopInterval = setInterval(gameLoop, 100);  // Actualizar progreso cada 100ms
}

function endGame(reason, isWin) {
  isPlaying = false;
  clearInterval(spawnerInterval);
  clearInterval(gameLoopInterval);

  const endScreen = $('end-screen');
  endScreen.style.display = 'flex';
  $('end-title').textContent = isWin ? '¡Sprint Finalizado!' : '¡Proyecto Fracasado!';
  $('end-title').style.color = isWin ? '#2ecc71' : '#e74c3c';
  $('end-reason').textContent = reason;
  $('end-score').textContent = score;

  saveScore();
}

async function saveScore() {
  if (score === 0) return;
  
  try {
    await saveGameResult('kanban_hero', currentUser.uid, classId, score, {});
    const res = await addPointsAndCheckLogros(currentUser.uid, score, null, 'tic2_users');
    
    // Medallas específicas del juego
    await awardMedal(currentUser.uid, 'first_blood');
    await awardMedal(currentUser.uid, 'agilista');
    if (score >= 150) {
      await awardMedal(currentUser.uid, 'productividad_extrema');
    }

    if (res && res.leagueUp) {
      showToast('¡Nueva Liga Desbloqueada!', `¡Has ascendido a la ${res.newLeague.name} ${res.newLeague.icon}!`, 'success', 5000);
    }
  } catch (err) {
    console.error("Error guardando score:", err);
  }
}

$('btn-restart').addEventListener('click', () => {
  $('end-screen').style.display = 'none';
  startGame();
});

function spawnTask() {
  if (!isPlaying) return;

  const tpl = taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
  const id = 'task-' + (++taskIdCounter);
  
  // Required progress entre 2 y 5 segundos (20 a 50 ticks)
  const reqProgress = Math.floor(Math.random() * 30) + 20;
  
  tasksData[id] = { doingProgress: 0, testingProgress: 0, required: reqProgress, isReadyDoing: false, isReadyTesting: false };

  const el = document.createElement('div');
  el.className = 'kanban-task';
  el.id = id;
  el.draggable = true;
  el.setAttribute('data-status', 'todo');
  
  el.innerHTML = `
    <div class="task-title">${tpl.title}</div>
    <div class="task-desc">${tpl.desc}</div>
    <div class="task-progress-bar">
      <div class="task-progress-fill" id="fill-${id}"></div>
    </div>
  `;

  // Drag Events
  el.addEventListener('dragstart', handleDragStart);
  el.addEventListener('dragend', handleDragEnd);

  zoneTodo.appendChild(el);
  updateHUD();

  if (zoneTodo.children.length > TODO_LIMIT) {
    endGame(`El To-Do se ha colapsado con más de ${TODO_LIMIT} tareas.`, false);
  }
}

function gameLoop() {
  if (!isPlaying) return;

  // Actualizar temporizador
  tickCounter++;
  if (tickCounter % 10 === 0) { // Cada segundo (100ms * 10)
    timeLeft--;
    updateHUD();
    
    if (timeLeft <= 0) {
      endGame('El tiempo del Sprint se ha agotado.', true);
      return;
    }

    // Aumentar dificultad drásticamente de forma segura
    if (timeLeft === 50) { clearInterval(spawnerInterval); spawnerInterval = setInterval(spawnTask, 2500); }
    if (timeLeft === 40) { clearInterval(spawnerInterval); spawnerInterval = setInterval(spawnTask, 1800); }
    if (timeLeft === 30) { clearInterval(spawnerInterval); spawnerInterval = setInterval(spawnTask, 1200); }
    if (timeLeft === 20) { clearInterval(spawnerInterval); spawnerInterval = setInterval(spawnTask, 800); }
    if (timeLeft === 10) { clearInterval(spawnerInterval); spawnerInterval = setInterval(spawnTask, 400); }
  }

  // Procesar tareas en Doing
  Array.from(zoneDoing.children).forEach(taskEl => {
    const id = taskEl.id;
    const data = tasksData[id];
    
    if (!data.isReadyDoing) {
      data.doingProgress++;
      const pct = (data.doingProgress / data.required) * 100;
      taskEl.querySelector('.task-progress-fill').style.width = pct + '%';
      
      if (data.doingProgress >= data.required) {
        data.isReadyDoing = true;
        taskEl.classList.add('ready');
      }
    }
  });

  // Procesar tareas en Testing
  Array.from(zoneTesting.children).forEach(taskEl => {
    const id = taskEl.id;
    const data = tasksData[id];
    
    if (!data.isReadyTesting) {
      data.testingProgress++;
      const testReq = Math.max(10, Math.floor(data.required / 2));
      const pct = (data.testingProgress / testReq) * 100;
      taskEl.querySelector('.task-progress-fill').style.width = pct + '%';
      
      if (data.testingProgress >= testReq) {
        data.isReadyTesting = true;
        taskEl.classList.add('ready');
      }
    }
  });


}

function updateHUD() {
  scoreDisplay.textContent = score;
  timerDisplay.textContent = timeLeft;
  
  const todoCount = zoneTodo.children.length;
  todoCountDisplay.textContent = todoCount;
  
  if (todoCount >= TODO_LIMIT - 1) {
    todoCountDisplay.style.color = '#e74c3c';
    todoCountDisplay.classList.add('shake');
    setTimeout(() => todoCountDisplay.classList.remove('shake'), 400);
  } else {
    todoCountDisplay.style.color = 'inherit';
  }
}

// --- Drag & Drop Logic ---
let draggedTask = null;

function handleDragStart(e) {
  if (!isPlaying) { e.preventDefault(); return; }
  draggedTask = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.id);
}

function handleDragEnd() {
  this.classList.remove('dragging');
  draggedTask = null;
  
  // Limpiar estilos de las columnas
  document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
}

// Configurar Columnas como Dropzones
document.querySelectorAll('.kanban-column').forEach(col => {
  col.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  });

  col.addEventListener('dragleave', () => {
    col.classList.remove('drag-over');
  });

  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (!draggedTask) return;

    const targetStatus = col.getAttribute('data-status');
    const currentStatus = draggedTask.getAttribute('data-status');
    const data = tasksData[draggedTask.id];

    // Reglas de Kanban
    
    // 1. A Todo desde Doing: Se puede devolver, pero reinicia el progreso
    if (targetStatus === 'todo' && currentStatus === 'doing') {
      zoneTodo.appendChild(draggedTask);
      draggedTask.setAttribute('data-status', 'todo');
      data.doingProgress = 0;
      draggedTask.querySelector('.task-progress-fill').style.width = '0%';
      draggedTask.classList.remove('ready');
      data.isReadyDoing = false;
      updateHUD();
      return;
    }

    // 2. A Doing desde Todo
    if (targetStatus === 'doing' && currentStatus === 'todo') {
      if (zoneDoing.children.length >= WIP_LIMIT) {
        showToast('Límite WIP Excedido', `Solo puedes tener ${WIP_LIMIT} tareas en Doing.`, 'warning', 2000);
        draggedTask.classList.add('shake');
        return;
      }
      zoneDoing.appendChild(draggedTask);
      draggedTask.setAttribute('data-status', 'doing');
      updateHUD();
      return;
    }

    // 3. A Testing desde Doing
    if (targetStatus === 'testing' && currentStatus === 'doing') {
      if (!data.isReadyDoing) {
        showToast('Tarea Incompleta', 'Debe terminar en Doing primero.', 'warning', 2000);
        draggedTask.classList.add('shake');
        return;
      }
      if (zoneTesting.children.length >= TESTING_WIP_LIMIT) {
        showToast('Límite WIP Excedido', `Solo puedes tener ${TESTING_WIP_LIMIT} tareas en Testing.`, 'warning', 2000);
        draggedTask.classList.add('shake');
        return;
      }
      zoneTesting.appendChild(draggedTask);
      draggedTask.setAttribute('data-status', 'testing');
      draggedTask.classList.remove('ready'); // Reseteamos el estado visual
      draggedTask.querySelector('.task-progress-fill').style.width = '0%';
      updateHUD();
      return;
    }

    // 4. A Done desde Testing
    if (targetStatus === 'done' && currentStatus === 'testing') {
      if (!data.isReadyTesting) {
        showToast('Testing Incompleto', 'La tarea aún no ha pasado el Testing.', 'warning', 2000);
        draggedTask.classList.add('shake');
        return;
      }
      
      zoneDone.appendChild(draggedTask);
      draggedTask.setAttribute('data-status', 'done');
      draggedTask.draggable = false;
      draggedTask.classList.remove('ready');
      
      score += POINTS_PER_TASK;
      updateHUD();
      return;
    }
  });
});

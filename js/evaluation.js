import { CYR_EVALUATION_DATA, $, escapeHtml } from './common/utils.js';
import { CLASSROOM_TASKS } from './common/tasks.js';
import { renderHeader } from './common/ui.js';
import { requireAuth } from './common/auth.js';

let currentMode = 'criterion';
let currentLevel = '2';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth({
    allowedRoles: ['teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      renderHeader(user, profile);
      initEvaluationPage();
    }
  });
});


function calculateTaskWeights() {
  const ces = {
    '1': ['1.1'],
    '2': ['2.1', '2.2'],
    '3': ['3.1'],
    '4': ['4.1'],
    '5': ['5.1', '5.2', '5.3']
  };

  const crit_tasks = {};
  CLASSROOM_TASKS.forEach(t => {
    t.total_weight = 0.0;
    if (t.crit) {
      t.crit.split(',').map(s=>s.trim()).forEach(c => {
        if(!crit_tasks[c]) crit_tasks[c] = [];
        crit_tasks[c].push(t);
      });
    }
  });

  const ce_weight = 100.0 / 5.0;

  Object.values(ces).forEach(crits => {
    const crit_weight = ce_weight / crits.length;
    crits.forEach(c => {
      const t_list = crit_tasks[c] || [];
      const num_tasks = t_list.length;
      if (num_tasks > 0) {
        const task_weight = crit_weight / num_tasks;
        t_list.forEach(t => {
          t.total_weight += task_weight;
        });
      }
    });
  });
}


function initEvaluationPage() {
  calculateTaskWeights();
  const levelSelect = $('level-select');
  const viewMode = $('view-mode');
  const courseContainer = $('course-selector-container');
  
  levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value;
    renderView();
  });
  
  viewMode.addEventListener('change', () => {
    currentMode = viewMode.value;
    if(currentMode === 'criterion') {
      courseContainer.style.display = 'block';
    } else {
      courseContainer.style.display = 'none'; // Blocks and Tasks view is global
    }
    renderView();
  });
  
  renderView();
}

function renderView() {
  if (currentMode === 'criterion') {
    renderByCriterion(currentLevel);
  } else if (currentMode === 'block') {
    renderByBlock();
  } else if (currentMode === 'task') {
    renderByTask();
  }
  bindTaskClicks();
}

function getTaskButton(t) {
  const isGame = isNaN(t.id);
  const extraClass = isGame ? 'btn-game-task' : 'btn-outline';
  const weightBadge = t.total_weight ? `<div style="font-size:0.75rem; margin-top:4px; opacity:0.8; font-weight: 500;">⚖️ Peso: ${t.total_weight.toFixed(2)}%</div>` : '';
  
  return `<button class="btn btn-sm ${extraClass} btn-task-detail" data-task-id="${t.id}" style="display:block; width:100%; text-align:left; white-space:normal; line-height: 1.4; height:100%;">
            📝 Tarea ${t.id}: <strong>${escapeHtml(t.title)}</strong>
            ${weightBadge}
          </button>`;
}

function renderByCriterion(level) {
  const criteriaList = CYR_EVALUATION_DATA[level] || CYR_EVALUATION_DATA[2];
  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:10%;">Crit.</th>
      <th style="width:50%;">Descripción (Andalucía)</th>
      <th style="width:40%;">Tareas Classroom</th>
    </tr>
  `;
  
  let html = '';
  criteriaList.forEach(c => {
    const matchingTasks = (level == 2) ? CLASSROOM_TASKS.filter(t => t.crit && t.crit.split(',').map(s => s.trim()).includes(c.crit)) : [];
    
    let tasksHtml = '<span style="color:var(--text-muted)">-</span>';
    if (matchingTasks.length > 0) {
      tasksHtml = `<div style="display:flex; flex-direction:column; gap:8px;">
        ${matchingTasks.map(getTaskButton).join('')}
      </div>`;
    }

    html += `
      <tr>
        <td style="font-weight:bold; color:var(--primary); font-size: 1.1rem;">${c.crit}</td>
        <td>
          <div style="font-weight: 500; margin-bottom: 5px;">${escapeHtml(c.text)}</div>
          <span class="badge">${escapeHtml(c.block)}</span>
        </td>
        <td>${tasksHtml}</td>
      </tr>
    `;
  });
  
  $('eval-tbody').innerHTML = html;
}

function renderByBlock() {
  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:15%;">Bloque</th>
      <th style="width:85%;">Tareas Asociadas</th>
    </tr>
  `;
  
  const blocks = {};
  CLASSROOM_TASKS.forEach(t => {
    const b = t.block || 'Desconocido';
    if(!blocks[b]) blocks[b] = [];
    blocks[b].push(t);
  });
  
  const sortedBlocks = Object.keys(blocks).sort((a,b) => parseInt(a) - parseInt(b));
  
  let html = '';
  sortedBlocks.forEach(b => {
    const tasksHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
      ${blocks[b].map(t => getTaskButton(t)).join('')}
    </div>`;
    
    html += `
      <tr>
        <td style="font-weight:bold; color:var(--primary); font-size: 1.2rem;">Bloque ${b}</td>
        <td>${tasksHtml}</td>
      </tr>
    `;
  });
  
  $('eval-tbody').innerHTML = html;
}

function renderByTask() {
  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:10%;">ID</th>
      <th style="width:40%;">Título</th>
      <th style="width:10%;">Bloque</th>
      <th style="width:15%;">Criterios</th>
      <th style="width:10%;">Peso</th>
      <th style="width:15%;">Acción</th>
    </tr>
  `;
  
  let html = '';
  const sortedTasks = [...CLASSROOM_TASKS].sort((a,b) => {
    const isNumA = !isNaN(a.id);
    const isNumB = !isNaN(b.id);
    if(isNumA && isNumB) return parseInt(a.id) - parseInt(b.id);
    if(isNumA) return -1;
    if(isNumB) return 1;
    return a.id.localeCompare(b.id);
  });
  
  sortedTasks.forEach(t => {
    html += `
      <tr>
        <td style="font-weight:bold; color:var(--text-muted); font-size: 1.1rem;">#${t.id}</td>
        <td style="font-weight:bold;">${escapeHtml(t.title)}</td>
        <td><span class="badge">Bloque ${t.block}</span></td>
        <td>${t.crit ? `<span class="badge badge--primary">Crit. ${t.crit}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
        <td style="font-weight:bold; color:#000;">${t.total_weight ? t.total_weight.toFixed(2) + '%' : '-'}</td>
        <td><button class="btn btn-sm btn-outline btn-task-detail" data-task-id="${t.id}">Ver Tarea</button></td>
      </tr>
    `;
  });
  
  $('eval-tbody').innerHTML = html;
}

function bindTaskClicks() {
  document.querySelectorAll('.btn-task-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-task-id');
      showTaskDetail(taskId);
      
      // Resaltar el botón activo
      document.querySelectorAll('.btn-task-detail').forEach(b => {
        b.classList.remove('btn-primary');
        if (!b.classList.contains('btn-game-task')) {
          b.classList.add('btn-outline');
        }
      });
      
      e.currentTarget.classList.remove('btn-outline');
      e.currentTarget.classList.add('btn-primary');
    });
  });
}

function showTaskDetail(taskId) {
  const task = CLASSROOM_TASKS.find(t => t.id === taskId);
  if (!task) return;
  
  const panel = $('task-detail-panel');
  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
      <h3 style="margin:0; color:var(--text-primary); font-size:1.5rem;">${escapeHtml(task.title)}</h3>
    </div>
    <div style="display:flex; gap: 10px; margin-bottom:20px;">
      <span class="badge">Bloque ${task.block}</span>
      ${task.crit ? `<span class="badge badge--primary">Criterio ${task.crit}</span>` : `<span class="badge badge--accent">No evaluable</span>`}
      ${task.total_weight ? `<span class="badge" style="background:#ffeb3b; color:#000;">Ponderación Final: ${task.total_weight.toFixed(2)}%</span>` : ''}
    </div>
    <p style="color:var(--text-secondary); margin-bottom:10px; font-weight:600;">Descripción de la tarea:</p>
    <div class="task-desc">${escapeHtml(task.description)}</div>
    <button id="btn-copy-task" class="btn btn-primary btn-lg" style="width:100%; font-size:1.1rem;">📋 Copiar Texto para Classroom</button>
  `;
  
  $('btn-copy-task').addEventListener('click', () => {
    navigator.clipboard.writeText(task.description).then(() => {
      const btn = $('btn-copy-task');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ ¡Copiado con éxito!';
      btn.style.backgroundColor = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
      }, 2000);
    });
  });
}

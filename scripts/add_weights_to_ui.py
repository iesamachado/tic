import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add calculation function and call it at initialization
calc_function = """
function calculateTaskWeights() {
  const ces = {
    '1': ['1.1', '1.2', '1.3', '1.4'],
    '2': ['2.1', '2.2', '2.3'],
    '3': ['3.1'],
    '4': ['4.1', '4.2'],
    '5': ['5.1', '5.2'],
    '6': ['6.1', '6.2', '6.3', '6.4']
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

  const ce_weight = 100.0 / 6.0;

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

"""

# Insert before initEvaluationPage
content = content.replace("function initEvaluationPage() {", calc_function + "\nfunction initEvaluationPage() {\n  calculateTaskWeights();")


# 2. Update getTaskButton
old_button = """function getTaskButton(t) {
  const isGame = isNaN(t.id);
  const extraClass = isGame ? 'btn-game-task' : 'btn-outline';
  
  return `<button class="btn btn-sm ${extraClass} btn-task-detail" data-task-id="${t.id}" style="display:block; width:100%; text-align:left; white-space:normal; line-height: 1.4; height:100%;">
            📝 Tarea ${t.id}: <strong>${escapeHtml(t.title)}</strong>
          </button>`;
}"""

new_button = """function getTaskButton(t) {
  const isGame = isNaN(t.id);
  const extraClass = isGame ? 'btn-game-task' : 'btn-outline';
  const weightBadge = t.total_weight ? `<div style="font-size:0.75rem; margin-top:4px; opacity:0.8; font-weight: 500;">⚖️ Peso: ${t.total_weight.toFixed(2)}%</div>` : '';
  
  return `<button class="btn btn-sm ${extraClass} btn-task-detail" data-task-id="${t.id}" style="display:block; width:100%; text-align:left; white-space:normal; line-height: 1.4; height:100%;">
            📝 Tarea ${t.id}: <strong>${escapeHtml(t.title)}</strong>
            ${weightBadge}
          </button>`;
}"""

content = content.replace(old_button, new_button)

# 3. Update showTaskDetail
detail_replace = "${task.crit ? `<span class=\"badge badge--primary\">Criterio ${task.crit}</span>` : `<span class=\"badge badge--accent\">No evaluable</span>`}"
new_detail = detail_replace + "\n      ${task.total_weight ? `<span class=\"badge\" style=\"background:#ffeb3b; color:#000;\">Ponderación Final: ${task.total_weight.toFixed(2)}%</span>` : ''}"
content = content.replace(detail_replace, new_detail)

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)


import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

header_old = """    <tr>
      <th style="width:15%;">ID</th>
      <th style="width:40%;">Título</th>
      <th style="width:15%;">Bloque</th>
      <th style="width:15%;">Criterio</th>
      <th style="width:15%;">Acción</th>
    </tr>"""

header_new = """    <tr>
      <th style="width:10%;">ID</th>
      <th style="width:40%;">Título</th>
      <th style="width:10%;">Bloque</th>
      <th style="width:15%;">Criterios</th>
      <th style="width:10%;">Peso</th>
      <th style="width:15%;">Acción</th>
    </tr>"""

content = content.replace(header_old, header_new)

row_old = """      <tr>
        <td style="font-weight:bold; color:var(--text-muted); font-size: 1.1rem;">#${t.id}</td>
        <td style="font-weight:bold;">${escapeHtml(t.title)}</td>
        <td><span class="badge">Bloque ${t.block}</span></td>
        <td>${t.crit ? `<span class="badge badge--primary">Crit. ${t.crit}</span>` : '<span style="color:var(--text-muted)">No evaluable</span>'}</td>
        <td><button class="btn btn-sm btn-outline btn-task-detail" data-task-id="${t.id}">Ver Tarea</button></td>
      </tr>"""

row_new = """      <tr>
        <td style="font-weight:bold; color:var(--text-muted); font-size: 1.1rem;">#${t.id}</td>
        <td style="font-weight:bold;">${escapeHtml(t.title)}</td>
        <td><span class="badge">Bloque ${t.block}</span></td>
        <td>${t.crit ? `<span class="badge badge--primary">Crit. ${t.crit}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
        <td style="font-weight:bold; color:#000;">${t.total_weight ? t.total_weight.toFixed(2) + '%' : '-'}</td>
        <td><button class="btn btn-sm btn-outline btn-task-detail" data-task-id="${t.id}">Ver Tarea</button></td>
      </tr>"""

content = content.replace(row_old, row_new)

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

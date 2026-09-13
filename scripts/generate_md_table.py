import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

regex = re.compile(r"\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)',\s*block:\s*'([^']+)',\s*crit:\s*'([^']*)'")
matches = regex.finditer(content)

tasks = []
for m in matches:
    t = {
        'id': m.group(1),
        'title': m.group(2),
        'block': m.group(3),
        'crit': m.group(4)
    }
    tasks.append(t)

# Calculate weights
ces = {
    '1': ['1.1', '1.2', '1.3', '1.4'],
    '2': ['2.1', '2.2', '2.3'],
    '3': ['3.1'],
    '4': ['4.1', '4.2'],
    '5': ['5.1', '5.2'],
    '6': ['6.1', '6.2', '6.3', '6.4']
}

crit_tasks = {}
for t in tasks:
    t['total_weight'] = 0.0
    if t['crit']:
        crits = [c.strip() for c in t['crit'].split(',')]
        for c in crits:
            if c not in crit_tasks:
                crit_tasks[c] = []
            crit_tasks[c].append(t)

ce_weight = 100.0 / 6.0
for ce_num, crits in ces.items():
    crit_weight = ce_weight / len(crits)
    for c in crits:
        t_list = crit_tasks.get(c, [])
        num_tasks = len(t_list)
        if num_tasks > 0:
            task_weight = crit_weight / num_tasks
            for t in t_list:
                t['total_weight'] += task_weight

# Generate Markdown table
md = "| ID | Tarea / Juego | Bloque | Criterio(s) | Peso (%) |\n"
md += "|:-:|:---|:---:|:---:|:---:|\n"

for t in tasks:
    weight_str = f"{t['total_weight']:.2f}%" if t['total_weight'] > 0 else "0.00% (No eval)"
    crit_str = t['crit'] if t['crit'] else "-"
    block_str = f"Bloque {t['block']}"
    md += f"| T{t['id']} | {t['title']} | {block_str} | {crit_str} | **{weight_str}** |\n"

print(md)

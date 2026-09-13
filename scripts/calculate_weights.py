import re
import json
from collections import defaultdict

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

tasks = []
matches = re.finditer(r"id:\s*'([^']+)',\s*title:\s*'([^']+)',\s*block:\s*'[^']+',\s*crit:\s*'([^']*)'", content)
for m in matches:
    # Handle multiple criteria e.g. "2.2, 5.2"
    crits = [c.strip() for c in m.group(3).split(',') if c.strip()]
    tasks.append({
        'id': m.group(1),
        'title': m.group(2),
        'crits': crits,
        'total_weight': 0.0
    })

ces = {
    '1': ['1.1', '1.2', '1.3', '1.4'],
    '2': ['2.1', '2.2', '2.3'],
    '3': ['3.1'],
    '4': ['4.1', '4.2'],
    '5': ['5.1', '5.2'],
    '6': ['6.1', '6.2', '6.3', '6.4']
}

crit_tasks = defaultdict(list)
for t in tasks:
    for c in t['crits']:
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

# Generate output sorted by weight descending
for t in sorted(tasks, key=lambda x: x['total_weight'], reverse=True):
    print(f"Tarea {t['id']}: {t['title']} (Crit: {', '.join(t['crits'])}) -> {t['total_weight']:.2f}%")

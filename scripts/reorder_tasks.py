import re
import json

# --- 1. UPDATE UTILS.JS ---
with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'r', encoding='utf-8') as f:
    utils_content = f.read()

# Remove block_iot and block_mobile
utils_content = re.sub(r"  block_iot: \{[\s\S]*?color: '#00bcd4'\n  \},", "", utils_content)
utils_content = re.sub(r"  block_mobile: \{[\s\S]*?color: '#bb86fc'\n  \},", "", utils_content)

# Rename old block4 to block5, old block5 to block6
utils_content = utils_content.replace("block5:", "block6:")
utils_content = utils_content.replace("id: 'block5'", "id: 'block6'")
utils_content = utils_content.replace("Bloque 5:", "Bloque 6:")
utils_content = utils_content.replace("temario/block5.html", "temario/block6.html")

utils_content = utils_content.replace("block4:", "block5:")
utils_content = utils_content.replace("id: 'block4'", "id: 'block5'")
utils_content = utils_content.replace("Bloque 4:", "Bloque 5:")
utils_content = utils_content.replace("temario/block4.html", "temario/block5.html")

# Insert new block4
new_block4 = """  block4: {
    id: 'block4',
    name: 'Bloque 4: IoT y Móvil',
    description: 'Sensores, Redes y Apps',
    icon: '📱',
    htmlPath: 'temario/block_mobile.html',
    color: '#00bcd4'
  },
"""
# find where block5 starts and insert before it
idx = utils_content.find("  block5: {")
utils_content = utils_content[:idx] + new_block4 + utils_content[idx:]

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'w', encoding='utf-8') as f:
    f.write(utils_content)

# --- 2. UPDATE TASKS.JS ---
with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'r', encoding='utf-8') as f:
    tasks_content = f.read()

# We will parse tasks.js manually or by regex
# tasks.js has a list export const CLASSROOM_TASKS = [ { ... }, { ... } ];
# and then CLASSROOM_TASKS.push(...)

# To parse JS reliably with regex when descriptions contain newlines and backticks:
task_pattern = r"(?:CLASSROOM_TASKS\.push\(\s*|\s*)\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)',\s*block:\s*'([^']+)',\s*crit:\s*'([^']*)',\s*description:\s*`([\s\S]*?)`\s*\}(?:\)|,)"
matches = re.finditer(task_pattern, tasks_content)

tasks = []
for m in matches:
    t = {
        'id': m.group(1),
        'title': m.group(2).replace('🟢 [NUEVA] ', ''), # Clean up title
        'block': m.group(3),
        'crit': m.group(4),
        'desc': m.group(5)
    }
    tasks.append(t)

# Fix specific task blocks based on new mapping
for t in tasks:
    if t['id'] == '30' or t['id'] == 'J7': # IoT & AppFlow
        t['block'] = '4'
    elif t['id'] in ['21', '22', '23', '24', '25', '32']: # AI & Big Data
        t['block'] = '5'
    elif t['id'] in ['26', '27', '28', 'J6']: # Cyber
        t['block'] = '6'
    elif t['id'] == '2' or t['id'] == '15':
        t['block'] = '1'

# Sort tasks: by block first, then by whether it's a game (games at the end of block), then by original ID
def sort_key(t):
    b = int(t['block'])
    is_game = t['title'].startswith('Juego:')
    # Try to keep relative original chronological order
    try:
        orig_id = int(t['id'])
    except ValueError:
        orig_id = 999
    return (b, is_game, orig_id)

tasks.sort(key=sort_key)

# Generate new JS content
new_js = "export const CLASSROOM_TASKS = [\n"
for i, t in enumerate(tasks):
    new_id = str(i + 1)
    # Fix the description indentation slightly if needed, but keeping it raw is fine
    desc = t['desc']
    comma = "," if i < len(tasks) - 1 else ""
    new_js += f"""  {{
    id: '{new_id}', title: '{t['title']}', block: '{t['block']}', crit: '{t['crit']}',
    description: `{desc}`
  }}{comma}\n"""
new_js += "];\n"

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'w', encoding='utf-8') as f:
    f.write(new_js)


import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_game = """  asimov: {
    id: 'asimov',
    name: 'Asimov.IO',
    description: 'Simulador ético de Inteligencia Artificial',
    icon: '⚖️',
    color: '#3b82f6',
    colorDark: '#1d4ed8',
    path: './asimov/index.html',
    gamePath: './asimov/index.html'
  },
"""

# Insert before rompecodigos or after appflow
idx = content.find("  appflow: {")
if idx != -1:
    content = content[:idx] + new_game + content[idx:]
else:
    # try inserting after GAMES = {
    idx = content.find("export const GAMES = {")
    if idx != -1:
        insert_idx = content.find("{", idx) + 1
        content = content[:insert_idx] + "\n" + new_game + content[insert_idx:]

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'w', encoding='utf-8') as f:
    f.write(content)


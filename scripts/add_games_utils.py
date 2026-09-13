import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_games = """  netdefender: {
    id: 'netdefender',
    name: 'NetDefender',
    description: 'Juego de defensa activa contra ataques informáticos',
    icon: '🛡️',
    color: '#ef4444',
    colorDark: '#b91c1c',
    path: './netdefender/index.html',
    gamePath: './netdefender/index.html'
  },
  trivial: {
    id: 'trivial',
    name: 'CyR Trivial',
    description: 'Demuestra lo que sabes respondiendo rápido',
    icon: '❓',
    color: '#eab308',
    colorDark: '#a16207',
    path: './trivial/index.html',
    gamePath: './trivial/index.html'
  },
"""

idx = content.find("export const GAMES = {")
if idx != -1:
    insert_idx = content.find("{", idx) + 1
    content = content[:insert_idx] + "\n" + new_games + content[insert_idx:]

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/utils.js', 'w', encoding='utf-8') as f:
    f.write(content)


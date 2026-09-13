import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to remove the task with id: '3'.
# It looks like:
#   {
#     id: '3', title: 'Mecanografía', block: '1', crit: '1.1',
#     description: `Accede a la plataforma MecanoClass y completa las lecciones indicadas por el profesor para mejorar tu velocidad y precisión al teclado.`
#   },

pattern_remove = r"\s*\{\s*id:\s*'3',\s*title:\s*'Mecanografía'[\s\S]*?\},"
content = re.sub(pattern_remove, "", content)

# Now decrement the IDs of tasks 4 to 29.
# We can search for `id: '(\d+)'` and if it's > 3, we subtract 1.
def dec_match(match):
    val = int(match.group(1))
    if val > 3:
        return f"id: '{val - 1}'"
    return match.group(0)

content = re.sub(r"id:\s*'(\d+)'", dec_match, content)

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)

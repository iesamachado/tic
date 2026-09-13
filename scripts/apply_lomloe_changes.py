import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update multi-criteria tasks
content = re.sub(r"(id:\s*'9',\s*title:\s*'Proyecto Mapa',\s*block:\s*'2',\s*crit:\s*)'2\.2'", r"\1'2.2, 5.2'", content)
content = re.sub(r"(id:\s*'10',\s*title:\s*'Gato Bross',\s*block:\s*'2',\s*crit:\s*)'1\.3'", r"\1'1.3, 2.2'", content)
content = re.sub(r"(id:\s*'20',\s*title:\s*'Proyecto Coche Teledirigido',\s*block:\s*'3',\s*crit:\s*)'3\.1'", r"\1'3.1, 1.4'", content)

# 2. Group tasks 6, 7, 8 into a single "Dossier Scratch" task.
# We'll replace T6, T7, T8 blocks entirely.
# First find where T6 starts and T9 starts.
idx_t6 = content.find("id: '6'")
idx_t9 = content.find("id: '9'")

if idx_t6 != -1 and idx_t9 != -1:
    dossier = """id: '6', title: 'Dossier Prácticas Scratch', block: '2', crit: '1.3',
    description: `Agrupación de prácticas de iniciación a Scratch. 
Debes entregar en esta misma tarea los siguientes 3 minijuegos:
1. Oso Polar (Movimiento básico).
2. Escarabajo se mueve (Sigue el puntero del ratón).
3. El Elefante hambriento (Tocar colores).
- Adjunta los tres archivos .sb3 de tus proyectos (obligatorio).`
  },
  {
    """
    
    # We replace from the '{' before "id: '6'" up to the '{' before "id: '9'"
    start_replace = content.rfind('{', 0, idx_t6)
    end_replace = content.rfind('{', 0, idx_t9)
    
    content = content[:start_replace] + "{\n    " + dossier + content[end_replace+1:]

with open('/media/disco/dades/src/ComputaciónYRobotica/js/common/tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)

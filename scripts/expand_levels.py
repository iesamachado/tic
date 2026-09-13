import re

with open('/media/disco/dades/src/ComputaciónYRobotica/appflow/js/game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We'll generate levels 26 to 60.
import random

sensors = ['btn_action', 'accelerometer', 'light_sensor', 'gps', 'battery', 'gyroscope', 'mic', 'nfc', 'camera', 'thermometer']
events_map = {
    'btn_action': ['click', 'long_press'],
    'accelerometer': ['shake'],
    'light_sensor': ['dark'],
    'gps': ['arrive'],
    'battery': ['low_level'],
    'gyroscope': ['shake'], 
    'mic': ['loud_noise'],
    'nfc': ['scan'],
    'camera': ['face_detect'],
    'thermometer': ['high_temp']
}
logics = ['if_morning', 'if_night', 'if_wifi', 'if_no_wifi', 'if_driving', 'and_facedown', 'and_moving']
actions = ['sound', 'flashlight', 'brightness_down', 'silent_mode', 'notify', 'dnd_mode', 'pay', 'unlock', 'call_911', 'music']

new_levels = []
for i in range(26, 61):
    template = random.choice([3, 4, 4, 4, 5]) 
    
    if template == 3:
        s = random.choice(sensors)
        e = random.choice(events_map[s])
        a = random.choice(actions)
        new_levels.append(f'  {{ text: "Pedido {i}: Haz que funcione esta lógica rápida.", slots: [\'sensor\', \'event\', \'action\'], req: {{ sensor: \'{s}\', event: \'{e}\', action: \'{a}\' }}, successMsg: "¡Siguiente!" }}')
    elif template == 4:
        # either double action or logic
        if random.choice([True, False]):
            s = random.choice(sensors)
            e = random.choice(events_map[s])
            a1 = random.choice(actions)
            a2 = random.choice([a for a in actions if a != a1])
            new_levels.append(f'  {{ text: "Pedido {i}: Combo de acción doble solicitado.", slots: [\'sensor\', \'event\', \'action_1\', \'action_2\'], req: {{ sensor: \'{s}\', event: \'{e}\', action_1: \'{a1}\', action_2: \'{a2}\' }}, successMsg: "¡Combo completado!" }}')
        else:
            s = random.choice(sensors)
            e = random.choice(events_map[s])
            l = random.choice(logics)
            a = random.choice(actions)
            new_levels.append(f'  {{ text: "Pedido {i}: Aplica un filtro condicional a este evento.", slots: [\'sensor\', \'event\', \'logic\', \'action\'], req: {{ sensor: \'{s}\', event: \'{e}\', logic: \'{l}\', action: \'{a}\' }}, successMsg: "¡Lógica perfecta!" }}')
    else:
        # 5 slots
        s1 = random.choice(sensors)
        l = random.choice([l for l in logics if l.startswith('and_')])
        s2 = random.choice([s for s in sensors if s != s1])
        a = random.choice(actions)
        new_levels.append(f'  {{ text: "Pedido {i}: Complejo multisesor. Combina dos inputs.", slots: [\'sensor_1\', \'logic\', \'sensor_2\', \'action\'], req: {{ sensor_1: \'{s1}\', logic: \'{l}\', sensor_2: \'{s2}\', action: \'{a}\' }}, successMsg: "¡Ingeniería avanzada!" }}')

new_levels_str = ',\n'.join(new_levels)

# Inject into the array
content = content.replace('// FASE 5: MASTER (Ritmo frenético)', '// FASE 5: MASTER (Ritmo frenético)')
# find the end of the LEVELS array
end_bracket = content.find('];\n\nconst BLOCKS')
levels_part = content[:end_bracket]
rest_part = content[end_bracket:]

content = levels_part + ',\n  // FASE 6: GENERACIÓN PROCEDURAL EXTREMA\n' + new_levels_str + rest_part

# Modify time logic
content = content.replace('addTimeBonus(12); // +12s de bonus para que tengan que ir rápido', 'let bonus = Math.max(3, 15 - Math.floor(currentLevel / 4));\n    addTimeBonus(bonus); // Bono de tiempo cada vez menor')

with open('/media/disco/dades/src/ComputaciónYRobotica/appflow/js/game.js', 'w', encoding='utf-8') as f:
    f.write(content)

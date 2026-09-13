import re

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the filter in renderByCriterion
old_filter = "CLASSROOM_TASKS.filter(t => t.crit === c.crit)"
new_filter = "CLASSROOM_TASKS.filter(t => t.crit && t.crit.split(',').map(s => s.trim()).includes(c.crit))"
content = content.replace(old_filter, new_filter)

# 2. Fix the filter in renderByBlock (if it uses t.crit)
# Let's check if there are other exact matches of t.crit
content = content.replace("t.crit === c.crit", "t.crit && t.crit.split(',').map(s => s.trim()).includes(c.crit)")

with open('/media/disco/dades/src/ComputaciónYRobotica/js/evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)


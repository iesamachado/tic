import re

with open('/media/disco/dades/src/ComputaciónYRobotica/roadmap.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the block starting with <li><h4><span class="badge badge-accent">En desarrollo</span> Asimov.IO</h4>
content = re.sub(r'<li>\s*<h4><span class="badge badge-accent">En desarrollo</span> Asimov\.IO</h4>[\s\S]*?</li>', '', content)

with open('/media/disco/dades/src/ComputaciónYRobotica/roadmap.html', 'w', encoding='utf-8') as f:
    f.write(content)


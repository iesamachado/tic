import urllib.request
import urllib.parse
import json
import re
import os

def download_ddg(query, filename):
    try:
        # Get vqd
        req1 = urllib.request.Request(f"https://duckduckgo.com/?q={urllib.parse.quote(query)}", headers={'User-Agent': 'Mozilla/5.0'})
        res1 = urllib.request.urlopen(req1).read().decode()
        vqd = re.search(r'vqd=([\d-]+)', res1).group(1)
        
        # Get images
        req2 = urllib.request.Request(f"https://duckduckgo.com/i.js?q={urllib.parse.quote(query)}&o=json&vqd={vqd}&f=,,,&p=1", headers={'User-Agent': 'Mozilla/5.0'})
        res2 = urllib.request.urlopen(req2).read().decode()
        data = json.loads(res2)
        
        for item in data['results'][:5]:
            img_url = item['image']
            if img_url.endswith('.jpg') or img_url.endswith('.png'):
                print(f"Found {query} -> {img_url}")
                urllib.request.urlretrieve(img_url, f"/media/disco/dades/src/ComputaciónYRobotica/temario/assets/img/{filename}")
                return
    except Exception as e:
        print(f"Error {query}: {e}")

download_ddg("R2D2 Star Wars", "r2d2.jpg")
download_ddg("Wall-E robot film", "walle.jpg")
download_ddg("Terminator T-800 endoskeleton", "terminator.jpg")
download_ddg("RoboCop movie robot", "robocop.jpg")
download_ddg("Johnny 5 Short Circuit", "johnny5.jpg")


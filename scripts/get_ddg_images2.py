import urllib.request
import urllib.parse
import json
import re
import os
import time

def download_ddg(query, filename):
    print(f"Searching {query}...")
    try:
        # Request 1
        req1 = urllib.request.Request(f"https://duckduckgo.com/?q={urllib.parse.quote(query)}&t=h_&iar=images&iax=images&ia=images", headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'})
        res1 = urllib.request.urlopen(req1).read().decode()
        match = re.search(r'vqd=([\d-]+)', res1)
        if not match:
            print(f"No vqd found for {query}")
            return
        vqd = match.group(1)
        time.sleep(1)
        
        # Request 2
        req2 = urllib.request.Request(f"https://duckduckgo.com/i.js?q={urllib.parse.quote(query)}&o=json&vqd={vqd}&f=,,,&p=1", headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        res2 = urllib.request.urlopen(req2).read().decode()
        data = json.loads(res2)
        
        for item in data['results']:
            img_url = item['image']
            if img_url.endswith('.jpg') or img_url.endswith('.jpeg'):
                print(f"Found {query} -> {img_url}")
                # Download
                req3 = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req3) as response:
                    with open(f"/media/disco/dades/src/ComputaciónYRobotica/temario/assets/img/{filename}", 'wb') as out_file:
                        out_file.write(response.read())
                return
    except Exception as e:
        print(f"Error {query}: {e}")

download_ddg("Wall-E robot pixar", "walle.jpg")
time.sleep(2)
download_ddg("Terminator T-800 endoskeleton movie", "terminator.jpg")
time.sleep(2)
download_ddg("RoboCop 1987 movie robot", "robocop.jpg")
time.sleep(2)
download_ddg("Johnny 5 Short Circuit robot", "johnny5.jpg")


import urllib.request
import json
import os

def download_wiki_img(title, filename):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        res = urllib.request.urlopen(req).read().decode()
        data = json.loads(res)
        if 'thumbnail' in data:
            img_url = data['thumbnail']['source']
            print(f"Found {title} -> {img_url}")
            # download it
            req2 = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
            img_data = urllib.request.urlopen(req2).read()
            with open(f"/media/disco/dades/src/ComputaciónYRobotica/temario/assets/img/{filename}", "wb") as f:
                f.write(img_data)
        else:
            print(f"No image for {title}")
    except Exception as e:
        print(f"Error {title}: {e}")

os.makedirs("/media/disco/dades/src/ComputaciónYRobotica/temario/assets/img", exist_ok=True)
download_wiki_img("Grace_Hopper", "grace_hopper.jpg")
download_wiki_img("R2-D2", "r2d2.jpg")
download_wiki_img("WALL-E", "walle.jpg")
download_wiki_img("Terminator_(character)", "terminator.jpg")
download_wiki_img("RoboCop_(character)", "robocop.jpg")
download_wiki_img("Johnny_5", "johnny5.jpg")


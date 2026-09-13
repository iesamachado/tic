import urllib.request
import json
import os

images = {
    "grace_hopper.jpg": "Commodore_Grace_M._Hopper.jpg",
    "ada_lovelace.jpg": "Ada_Lovelace_portrait.jpg",
    "alan_turing.jpg": "Alan_Turing_Aged_16.jpg",
    "r2d2.jpg": "R2-D2_in_the_Smithsonian_Institution.jpg",
    "walle.jpg": "Walle_at_the_El_Capitan_Theatre_-_Hollywood.jpg",
    "terminator.jpg": "Terminator_endoskeleton.jpg",
    "robocop.jpg": "Robocop_1.jpg",
    "johnny5.jpg": "Johnny_5.jpg"
}

out_dir = "/media/disco/dades/src/ComputaciónYRobotica/temario/assets/img"
os.makedirs(out_dir, exist_ok=True)

for fname, wiki_name in images.items():
    api_url = f"https://en.wikipedia.org/w/api.php?action=query&titles=File:{wiki_name}&prop=imageinfo&iiprop=url&format=json"
    try:
        req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            pages = data['query']['pages']
            page = list(pages.values())[0]
            if 'imageinfo' in page:
                img_url = page['imageinfo'][0]['url']
                print(f"Downloading {fname} from {img_url}")
                urllib.request.urlretrieve(img_url, os.path.join(out_dir, fname))
            else:
                print(f"Not found: {wiki_name}")
    except Exception as e:
        print(f"Error {fname}: {e}")

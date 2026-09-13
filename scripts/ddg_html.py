import urllib.request
import re

def get_image(query):
    url = "https://html.duckduckgo.com/html/?q=" + urllib.request.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        res = urllib.request.urlopen(req).read().decode('utf-8')
        # Find the first image result link or first image embedded
        links = re.findall(r'img src="([^"]+\.jpg)"', res)
        if not links:
            links = re.findall(r'href="([^"]+\.jpg)"', res)
        if links:
            print(f"{query} -> {links[0]}")
    except Exception as e:
        print(f"Error {query}: {e}")

get_image("Grace Hopper admiral portrait site:wikimedia.org")
get_image("Wall-e robot pixar movie site:imdb.com")

import urllib.request
import json
import urllib.parse

def search_image(query):
    url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&srnamespace=6&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for item in data['query']['search'][:3]:
                print(f"{query} -> {item['title']}")
    except Exception as e:
        print(f"Error {query}: {e}")

search_image("Wall-E")

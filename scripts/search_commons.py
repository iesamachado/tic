import urllib.request
import json
import urllib.parse

def search_commons(query):
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&srnamespace=6&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for item in data['query']['search'][:1]:
                print(f"{query} -> {item['title']}")
    except Exception as e:
        print(f"Error {query}: {e}")

search_commons("Wall-E robot character")
search_commons("R2-D2 Droid")
search_commons("Terminator endoskeleton")
search_commons("Robocop Statue")
search_commons("Johnny 5 robot")

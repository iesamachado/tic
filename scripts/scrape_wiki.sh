get_wiki_img() {
    curl -sL "https://en.wikipedia.org/wiki/$1" | grep -oP 'src="//upload.wikimedia.org/wikipedia/commons/thumb/[^"]+"' | head -n 1 | sed 's/src="\/\//https:\/\//' | sed 's/"//g'
}
get_wiki_img "WALL-E"
get_wiki_img "Terminator_(character)"
get_wiki_img "RoboCop_(character)"
get_wiki_img "Short_Circuit"

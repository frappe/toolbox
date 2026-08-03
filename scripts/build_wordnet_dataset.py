#!/usr/bin/env python3
"""Build the Dictionary tool's staged-import dataset from Princeton WordNet.

WordNet 3.1 is a lexical database from Princeton University under a permissive
license (https://wordnet.princeton.edu/license-and-commercial-use). This script
turns the raw WordNet DB files into the normalized JSONL that
`toolbox.dictionary_data.import_dictionary_jsonl` imports — keeping the dataset
reproducible from the public source rather than committing the 40 MB output.

Usage:
    # 1. download + extract the WordNet 3.1 DB
    curl -O https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz
    tar xzf wn3.1.dict.tar.gz            # -> ./dict/data.noun, data.verb, ...
    # 2. build the dataset
    python build_wordnet_dataset.py ./dict ./dictionary.jsonl

Output: one JSON object per line, sorted by word:
    {"word": "dog", "senses": [{"pos", "definition", "examples": [...], "synonyms": [...]}]}
"""
import json
import sys
from pathlib import Path

# WordNet synset-type code -> human part of speech (satellite adjectives fold into adjective).
POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
DATA_FILES = ("data.noun", "data.verb", "data.adj", "data.adv")


def clean_word(word: str) -> str:
	return word.replace("_", " ").strip()


def split_gloss(gloss: str) -> tuple[str, list[str]]:
	"""A WordNet gloss is 'definition; "example"; "example"' — examples are quoted and trail."""
	definition_parts: list[str] = []
	examples: list[str] = []
	seen_example = False
	for part in (piece.strip() for piece in gloss.split(";")):
		if part.startswith('"'):
			seen_example = True
			text = part.strip('"').strip()
			if text:
				examples.append(text)
		elif not seen_example and part:
			definition_parts.append(part)
	return "; ".join(definition_parts).strip(), examples


def parse(dict_dir: Path) -> dict[str, list[dict]]:
	entries: dict[str, list[dict]] = {}
	for name in DATA_FILES:
		with (dict_dir / name).open(encoding="utf-8", errors="replace") as handle:
			for line in handle:
				if not line[:8].isdigit() or "|" not in line:
					continue  # license header / non-data line
				left, gloss = line.split("|", 1)
				fields = left.split()
				if len(fields) < 5:
					continue
				try:
					word_count = int(fields[3], 16)  # w_cnt is 2-digit hex
				except ValueError:
					continue
				words = [
					clean_word(fields[4 + 2 * index])
					for index in range(word_count)
					if 4 + 2 * index < len(fields)
				]
				pos = POS.get(fields[2], fields[2])
				definition, examples = split_gloss(gloss.strip())
				if not definition or not words:
					continue
				for word in words:
					synonyms = [other for other in words if other != word]
					entries.setdefault(word, []).append(
						{"pos": pos, "definition": definition, "examples": examples, "synonyms": synonyms}
					)
	return entries


def main() -> None:
	if len(sys.argv) != 3:
		sys.exit("usage: build_wordnet_dataset.py <wordnet-dict-dir> <output.jsonl>")
	dict_dir = Path(sys.argv[1])
	output = Path(sys.argv[2])
	entries = parse(dict_dir)
	with output.open("w", encoding="utf-8") as out:
		for word in sorted(entries):
			out.write(json.dumps({"word": word, "senses": entries[word]}, ensure_ascii=False) + "\n")
	print(f"words: {len(entries)}  senses: {sum(len(v) for v in entries.values())}  -> {output}")


if __name__ == "__main__":
	main()

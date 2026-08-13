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
    {"word": "dog", "senses": [{"pos", "definition", "examples": [...], "synonyms": [...],
     "antonyms": [...]}]}
"""
import json
import sys
from collections import namedtuple
from pathlib import Path

# WordNet synset-type code -> human part of speech (satellite adjectives fold into adjective).
POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
# The file a synset came from, which is what a pointer names. Satellite adjectives live in
# data.adj and are pointed at as "a", so the key has to be the file rather than the synset type.
DATA_FILES = {"data.noun": "n", "data.verb": "v", "data.adj": "a", "data.adv": "r"}
ANTONYM_POINTER = "!"

Synset = namedtuple("Synset", "key words pos definition examples antonym_pointers")


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
	"""Read every synset, then resolve antonyms, which point from one synset to another."""
	synsets = [synset for name, pos in DATA_FILES.items() for synset in read_synsets(dict_dir / name, pos)]
	words_by_key = {synset.key: synset.words for synset in synsets}

	entries: dict[str, list[dict]] = {}
	for synset in synsets:
		antonyms = resolve_antonyms(synset, words_by_key)
		for index, word in enumerate(synset.words):
			entries.setdefault(word, []).append({
				"pos": synset.pos,
				"definition": synset.definition,
				"examples": synset.examples,
				"synonyms": [other for other in synset.words if other != word],
				"antonyms": antonyms.get(index, []),
			})
	return entries


def read_synsets(path: Path, file_pos: str) -> list[Synset]:
	synsets = []
	with path.open(encoding="utf-8", errors="replace") as handle:
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
			definition, examples = split_gloss(gloss.strip())
			if not definition or not words:
				continue
			synsets.append(Synset(
				key=(file_pos, fields[0]),
				words=words,
				pos=POS.get(fields[2], fields[2]),
				definition=definition,
				examples=examples,
				antonym_pointers=read_antonym_pointers(fields, word_count),
			))
	return synsets


def read_antonym_pointers(fields: list[str], word_count: int) -> list[tuple[int, tuple[str, str], int]]:
	"""Antonymy is a relation between two words, not between two synsets.

	`! 00002098 a 0101` reads: the first word here is the antonym of the first word of adjective
	synset 00002098. The last field is two hex byte counts, source then target, and it is `0000`
	for the synset-to-synset pointers that carry every other relation. WordNet always writes
	antonyms with both set, so a `0000` here would be a malformed record rather than a pair that
	holds for the whole synset.
	"""
	start = 4 + 2 * word_count
	if start >= len(fields):
		return []
	try:
		pointer_count = int(fields[start])
	except ValueError:
		return []

	pointers = []
	for index in range(pointer_count):
		pointer = fields[start + 1 + 4 * index : start + 5 + 4 * index]
		if len(pointer) < 4 or pointer[0] != ANTONYM_POINTER:
			continue
		try:
			source = int(pointer[3][:2], 16)
			target = int(pointer[3][2:], 16)
		except ValueError:
			continue
		if source and target:
			pointers.append((source - 1, (pointer[2], pointer[1]), target - 1))
	return pointers


def resolve_antonyms(synset: Synset, words_by_key: dict[tuple[str, str], list[str]]) -> dict[int, list[str]]:
	"""Map each word position in this synset to the words it is recorded as the opposite of."""
	antonyms: dict[int, list[str]] = {}
	for source, key, target in synset.antonym_pointers:
		words = words_by_key.get(key)
		if source >= len(synset.words) or not words or target >= len(words):
			continue
		found = words[target]
		if found not in antonyms.setdefault(source, []):
			antonyms[source].append(found)
	return antonyms


def main() -> None:
	if len(sys.argv) != 3:
		sys.exit("usage: build_wordnet_dataset.py <wordnet-dict-dir> <output.jsonl>")
	dict_dir = Path(sys.argv[1])
	output = Path(sys.argv[2])
	entries = parse(dict_dir)
	with output.open("w", encoding="utf-8") as out:
		for word in sorted(entries):
			out.write(json.dumps({"word": word, "senses": entries[word]}, ensure_ascii=False) + "\n")
	senses = [sense for word_senses in entries.values() for sense in word_senses]
	with_antonyms = sum(1 for sense in senses if sense["antonyms"])
	print(
		f"words: {len(entries)}  senses: {len(senses)}  "
		f"senses with an antonym: {with_antonyms}  -> {output}"
	)


if __name__ == "__main__":
	main()

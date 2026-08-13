## How it works

Dictionary reads WordNet 3.1, the lexical database built at Princeton University. Toolbox holds its
own copy of that data and looks a word up in it directly. The copy carries 147,982 entries.

A word rarely has one meaning. In WordNet it has senses, and the page groups them by part of speech
in the order noun, verb, adjective, adverb. Each sense carries a definition, the example sentences
WordNet records for it, and the other words that mean the same thing in that sense.

1. Type a word. Suggestions appear when you stop typing.
2. Press Look up, or select a suggestion.
3. Read the senses, grouped by part of speech.
4. Read the synonyms and the antonyms of every sense, each gathered into one list for each part
   of speech.
5. Select any of those words to look it up in turn.

A synonym belongs to a sense rather than to the word, so a word with many senses answers the
question many times over, with repeats. Each sense keeps its own list, and the Synonyms section
under the definitions gathers all of them into one list for each part of speech. The word `quiet`
has 13 senses which name 29 different words between them.

Antonyms are gathered the same way and are much rarer. WordNet records an opposite between two
particular words, not between two meanings, so 6,645 of the 147,982 entries carry one at all. The
Antonyms section says plainly when a word has none.

When no entry matches, the page offers near matches rather than nothing. The server collects words
that begin with what you typed, then with the same text minus its last character, and so on for up
to three characters. It ranks that pool by edit distance from your word, then by length, then
alphabetically, and returns at most eight.

## Worked examples

### The 13 senses of quiet

`quiet` returns four nouns, two verbs, six adjectives and one adverb.

The first noun sense is "a disposition free from stress or emotion", and its synonyms are
**repose**, **placidity**, **serenity**, **tranquillity** and **tranquility**. The second is "the
absence of sound", with the synonym **silence** and the example "he needed silence in order to
sleep".

### The opposites of right

`right` has 34 senses, and ten of them record an opposite. Written out sense by sense they read
**wrong**, **left**, **wrong**, **wrong**, **wrong**, **left**, **center**, **left**, **wrong**,
**wrongly** — five of them the same word.

Gathered, they become four short answers. As a noun the opposite is **wrong** or **left**. As a
verb, **wrong**. As an adjective, **wrong**, **left** or **center**. As an adverb, **wrongly** or
**left**.

The word appears under more than one part of speech because it is a different opposite in each. A
right answer is not a wrong one; a right hand is not a left one.

### A misspelled word: serendipitty

Nothing matches `serendipitty`. Trimming two characters from the end leaves `serendipit`, and two
entries begin with it, so the page offers **serendipity** and **serendipitous**.

The same method fails on `seperate`, which returns nothing. No entry begins with `seper`, and the
search only trims the end of a word, so a wrong letter in the middle puts the right word out of
reach.

## Frequently asked questions

### Why can it not find a word I know?

WordNet 3.1 was published in 2011, so a word coined after that is absent. It also holds few proper
nouns and few technical terms.

### Does it work without an internet connection?

No. The dataset lives on the Toolbox server, not in your browser, so every lookup needs a
connection. The page says so plainly rather than show a stale answer.

### Is my search kept anywhere?

No. The word reaches the server, the server answers, and nothing is written down. There is no
account. The list of recent searches is held in your own browser and has a Clear button.

### What are the quoted lines under a definition?

They are the usage examples WordNet stores. In the raw data the definition and its examples are one
field, with the examples quoted at the end. Toolbox splits them apart.

### Why does this word have no antonyms?

Because most words have none. WordNet records an opposite between two particular words rather than
between two meanings, and one was recorded for 6,645 of the 147,982 entries. Adjectives carry most
of them, because an adjective usually has a clear opposite and a noun usually does not. There is no
opposite of `chair`.

### Why do two entries share the same definition and synonyms?

Because those words share a sense. A definition belongs to the group of words, not to one word, so
every member of the group carries the same wording.

### Is it American or British English?

WordNet was compiled in the United States and prefers American spelling. It does record common
variants side by side, so `tranquility` and `tranquillity` both appear among the synonyms of
`quiet`.

## Good to know

WordNet started at Princeton University in the mid-1980s, under the psychologist George Armitage
Miller. It was not written as a dictionary for readers. It was written to model how words are stored
in the mind, which is why it organizes meaning rather than spelling.

The unit it is built from is the **synset**, short for synonym set: a group of words that can stand
in for one another in some context. One synset is one concept. `silence` and the second noun sense
of `quiet` belong to the same synset, which is why each is listed as a synonym of the other.

Antonymy is the exception to that structure. It joins two words rather than two synsets, because
opposition is a fact about words and not about concepts. `heavy` and `light` are opposites; the
synonyms of `heavy` are not all opposites of the synonyms of `light`.

Adjectives come in two kinds, a head and its satellites, where a satellite is a shade of the head
meaning. Toolbox folds both into one part of speech, because the difference matters to a researcher
and not to a reader.

For a word written in another script, use [Script Conversion](/script-conversion).

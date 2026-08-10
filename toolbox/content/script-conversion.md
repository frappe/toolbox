## How it works

Script Conversion rewrites text from one writing system into another. It does not translate. The
sounds are carried across and the meaning is left alone, so Hindi written in Roman letters is still
Hindi. A reader who does not know the language can now pronounce it. A reader who does know it can
read it in a script they are used to.

The conversion runs on your device, using the open source Sanscript library under the MIT license.
Nothing you type is sent to a server.

Eighteen schemes are offered. Eleven are scripts: **Devanagari**, **Bengali**, **Gujarati**,
**Gurmukhi**, **Kannada**, **Malayalam**, **Odia**, **Tamil**, **Telugu**, **Grantha** and
**Sinhala**. Seven write the same sounds in Roman letters. **IAST** and **ISO 15919** use marks
above and below the letters. **ITRANS**, **Harvard-Kyoto**, **SLP1**, **Velthuis** and **WX** use
plain keyboard characters only.

1. Choose the scheme you are writing in and the scheme you want.
2. Type or paste the text. The output appears as you type.
3. Press Detect script if you are not sure what the input is.
4. Copy the output, or download it as a text file.

Characters the library does not recognize pass through unchanged, so punctuation, digits and words
in other alphabets survive a conversion.

## Worked examples

### namaste, typed on an ordinary keyboard

Set the input scheme to ITRANS and the output to Devanagari. Type `namaste` and the output is
`नमस्ते`. Press the swap button and the output becomes the input. Devanagari to IAST returns
`namaste`, so this word survives the round trip unchanged.

### One word in six schemes

The Devanagari `संस्कृतम्` is written `saṃskṛtam` in IAST, `saṁskr̥tam` in ISO 15919, `saMskRtam` in
Harvard-Kyoto, `saMskftam` in SLP1, `saMskRRitam` in ITRANS, and `সংস্কৃতম্` in Bengali.

The two schemes with marks disagree on one vowel. IAST writes it `ṛ` and ISO 15919 writes it `r̥`.
Both describe the same sound.

## Frequently asked questions

### Does this translate my text?

No. It changes the letters, not the words. `namaste` becomes `नमस्ते`, which is the same word in a
different script. To find out what an English word means, use the [Dictionary](/dictionary).

### Which languages does it cover?

The schemes are writing systems rather than languages, and one script serves many languages.
Devanagari is used for Hindi, Marathi, Nepali and Sanskrit. Bengali script is used for Bengali and
Assamese. Gurmukhi is used for Punjabi.

### Why does converting back not return what I started with?

Because some scripts write fewer distinctions than others. Tamil has one letter, `க`, where
Devanagari has four: `क`, `ख`, `ग` and `घ`. All four give `க`. Converting `க` back has to choose
one, so all four return as `घ`. The word `भारत` goes to Tamil as `பாரத` and comes back as `भारध`.

### Is my text sent anywhere?

No. The library runs in your browser. There is no account, nothing is uploaded, and the text is gone
when you close the tab.

### Does it work without an internet connection?

Yes. The application is stored in your browser after your first visit, and the conversion needs
nothing else.

### Which Roman scheme should I choose?

Choose IAST or ISO 15919 to be read by a person, because printed books use those forms. Choose
ITRANS, Harvard-Kyoto, SLP1, Velthuis or WX to type on a plain keyboard, because each uses ordinary
characters only.

## Good to know

Transliteration is reversible only when both scripts record the same distinctions. Devanagari to
IAST is a one-to-one map, so text can go out and come back unchanged. Devanagari to Tamil is not,
because Tamil script does not mark the difference between an unvoiced, aspirated, voiced and voiced
aspirated consonant. That difference is not lost in Tamil, where a reader supplies it from the word
being read. It is lost in the conversion, because no letter is left to carry it.

SLP1 and WX were designed for machines rather than readers. Each uses exactly one ASCII character
for each sound, so a program can count, sort and compare letters without decoding a multi-byte
script. This is why `saMskRRitam` in ITRANS becomes `saMskftam` in SLP1, where a single `f` stands
for the vowel IAST writes as `ṛ`.

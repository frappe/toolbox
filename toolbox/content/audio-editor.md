## How it works

Audio Editor opens one audio file, lets you shorten it, fade it and change its loudness, and writes
a new file back to your device. Every step happens inside the browser, and nothing is uploaded.

Your browser decodes the file into raw samples, which the page draws as a waveform. Any format it
can decode works, which usually means WAV, MP3, OGG and M4A.

1. Choose an audio file, or arrive here from the [Audio Recorder](/audio-recorder).
2. Drag the Start and End controls to keep only the part you want.
3. Set a fade in, a fade out, and a gain between −24 and +12 decibels.
4. Press Preview edit to hear the result.
5. Download the file.

Nothing changes until you export. The edit is held as a set of values, so undo and redo step through
up to 50 changes and the original samples stay untouched.

On export the trimmed part is cut out first, the gain is applied to every sample, and the two fades
are drawn over the ends as straight lines. WAV is always offered. A compressed Opus file is offered
as well when your browser can encode one.

## Worked examples

### One minute of stereo, as WAV and as Opus

A one minute clip recorded at 48 kilohertz in stereo holds 2,880,000 samples in each channel. As a
16-bit WAV that is 44 bytes of header plus two bytes for every sample of every channel, which the
page reports as about 11.0 megabytes. The same minute as Opus at 96 kilobits per second is about 703
kilobytes, roughly a sixteenth of the size.

### Turning a quiet recording up by 6 decibels

Set the gain to +6. Decibels are a logarithmic ratio, so every sample is multiplied by
`10 ^ (6 / 20)`, which is about 1.995. Set it to −6 and every sample is halved.

A sample that reaches past the maximum is clipped to the maximum on export, so raising the gain on a
recording that is already loud will distort it.

## Frequently asked questions

### Why is the exported WAV so much larger than the file I opened?

Because WAV holds every sample in full. An MP3 or an M4A is compressed, and decoding it restores the
full set of samples. Writing those out as WAV turns a small file into a large one.

### Why does the Opus export take as long as the clip?

Because your browser encodes it by playing the audio into its own recorder, in real time. A three
minute clip takes about three minutes. WAV is written at once.

### Does my audio leave the browser?

No. The file is read, edited and written back by your browser. Nothing is sent to a server, and
nothing is kept when you leave.

### What happens when I reload the page?

The clip and the edit are both gone, and nothing is saved between visits. A recording handed over
from the Audio Recorder is passed in memory and is cleared once the Editor takes it.

### Can I join two clips, or edit several tracks?

No. The Editor works on one clip at a time, on a single track. Trim, fade and gain are the
operations it offers.

## Good to know

A WAV file is large because it stores sound as it was measured, with no compression. Its size is the
sample rate times the channel count times the bytes for each sample times the seconds. At 48
kilohertz in 16-bit stereo that is 192,000 bytes for every second, whatever the recording contains.
A minute of silence and a minute of an orchestra take the same space.

Only 44 bytes of a WAV file describe it: the sample rate, the channel count and the sample size.
Everything after that header is audio. The format carries no patent and needs no codec license,
which is why this Editor can always write one.

A fade here is a straight line, not a curve. Samples rise evenly from zero to full, so the loudness
you hear climbs quickly and then levels off, because loudness follows a logarithm and a line does
not.

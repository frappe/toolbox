## How it works

Audio Recorder captures sound from a microphone using the recording machinery already built into
your browser. There is no upload, because there is nowhere to upload to. Toolbox keeps no files and
has no accounts.

Your browser asks for permission the first time you press Record. It then chooses the file format
itself, from a list Toolbox offers in order: WebM holding Opus, plain WebM, Ogg holding Opus, and
MP4. The format it picked is shown with the finished recording.

1. Choose a microphone, if more than one is connected.
2. Choose a quality: 24, 64, 128 or 192 kilobits per second. The default is 64, in mono.
3. Press Record and allow the microphone.
4. Pause and resume as you like, then press Stop.
5. Save the file to your device, or open it in the [Audio Editor](/audio-editor).

While recording, a moving waveform and a level meter show that sound is arriving. The recording
itself is held in the browser tab, which is what sets its limit: it stops at 10 minutes or 100
megabytes, whichever comes first.

On a Chromium browser you can lift that limit. Tick "Record straight to a file on my device" and
choose the destination before the microphone opens. Each piece of audio is then written to your file
as it arrives, so no length limit applies and a crash cannot lose what is already written.

## Worked examples

### A ten minute voice note at the default quality

The default preset asks for 64 kilobits per second in mono. Ten minutes at that rate is about
4,800,000 bytes, or about 4.6 megabytes.

The duration limit is what stops this recording, not the size limit. Even the highest preset, 192
kilobits per second in stereo, would need about 73 minutes to reach 100 megabytes.

### An hour long meeting

Recording for an hour is possible only with the file option on a Chromium browser. Without it the
capture stops at 10 minutes, keeps what it has, and states why it stopped.

## Frequently asked questions

### Is my recording uploaded anywhere?

No. The audio never leaves your device. It exists in the browser tab, or in the file you chose, and
nowhere else. Toolbox has no account and no storage for it.

### What happens if I close or reload the tab?

An unsaved recording is lost. The page says so under the preview: save it before you close or
reload. A recording written straight to a file is already on your disk and survives.

### Why did my recording stop on its own?

It reached a limit, and the page states which one. Both limits exist because a phone browser kills a
tab that keeps filling with audio, which would lose the recording it was holding.

### What file format do I get?

Whatever your browser records in. Most produce WebM containing Opus, and some produce MP4. The saved
file gets a matching extension.

### Can I record for longer than 10 minutes?

Yes, on a Chromium browser, by recording straight to a file on your device. The limit protects audio
held in memory, so writing to disk removes it.

### Does it work without an internet connection?

Yes. The application is stored in your browser after your first visit, and recording uses your
microphone and your browser only.

## Good to know

Opus is the codec most browsers record in here. It was designed for speech and music in one format,
it is royalty free, and it is an open standard, so a browser can use it without a license fee. At 64
kilobits per second it holds speech in about one twelfth of the space the same sound takes as
uncompressed 16-bit samples at 48 kilohertz.

A bitrate is a target, not a rule. The recorder may spend fewer bits on silence and more on a loud
passage, so two recordings of the same length rarely have the same size. This is why Toolbox counts
bytes as well as seconds.

The button that opens the Editor hands the recording across in memory rather than through a server.
It works once, and a reload clears it.

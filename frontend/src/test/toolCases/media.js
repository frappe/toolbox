// Both tools work on audio the browser captures or the visitor supplies, so a headless run cannot
// prove a recording sounds right. What it can prove is that the page offers the controls and
// refuses nothing it should accept.
//
// The arithmetic these two depend on is covered without a browser: `wavEncode`, `audioEdit`,
// `audioFormat`, `recorderPresets` and `fileSink` each have their own unit tests, and those run in
// the units layer. The QA report shows this as a render check rather than as a full pass, which is
// the honest reading.
export const mediaCases = [
  {
    toolId: 'audio-recorder',
    route: '/audio-recorder',
    cases: [
      {
        name: 'offers a record control, or says why it cannot',
        // Whether the tool can record depends on the browser, not on the tool: `mediaDevices` is
        // granted only in a secure context and only where a microphone exists. Both answers are
        // correct, and saying which one it gave is the behaviour worth holding. Requiring the
        // control alone made this fail on every CI engine while the page was doing exactly the
        // right thing.
        fill: [],
        expect: {
          oneOf: [/quality|preset|format/i, 'needs a browser with microphone support'],
        },
      },
    ],
  },
  {
    toolId: 'audio-editor',
    route: '/audio-editor',
    cases: [
      {
        name: 'asks for a file before it offers an edit',
        fill: [],
        expect: { contains: [/choose|open|upload|drop|select/i] },
      },
    ],
  },
]

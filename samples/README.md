# Offline instrument samples

All built-in HarmonyForge instruments (`INS-001` … `INS-009`) use **offline** MP3 samples under this folder. Paths are relative to `index.html` at the project root (e.g. `samples/INS-008/A4.mp3`).

| ID | Role | Source (bundled) |
|----|------|------------------|
| INS-001 | Kick | [Tone.js acoustic-kit](https://github.com/Tonejs/audio/tree/master/drum-samples/acoustic-kit) |
| INS-002 | Snare | acoustic-kit |
| INS-003 | Closed hi-hat | acoustic-kit |
| INS-004 | Open hi-hat | [hihat-short](https://github.com/Tonejs/audio/tree/master/drum-samples) |
| INS-005 | Tom | acoustic-kit |
| INS-006 | Cymbal | acoustic-kit |
| INS-007 | Bass multisample | [Casio keys](https://github.com/Tonejs/audio/tree/master/casio) (subset) |
| INS-008 | Piano multisample | [Salamander](https://github.com/Tonejs/audio/tree/master/salamander) |
| INS-009 | Chord pad | [berklee Analogsynth2](https://github.com/Tonejs/audio/tree/master/berklee) (`pad.mp3`) |

`INS-000` is an empty track carrier (no samples).

To add a custom sampler slot, create `samples/<INS-id>/` and register `kind: "sampler"` in `js/instrument-registry.js`.

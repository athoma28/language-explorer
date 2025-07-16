# Language Explorer

A lightweight, browser-based interface for exploring parallel language lessons with live audio playback, per-lesson metadata, and optional markdown descriptions.

## Prerequisites

You’ll need:

- **Node.js** (v14+ recommended) and **npm**  
- A terminal or command prompt, already `cd`-ed into this project’s root folder  

## Installation

Install dependencies once:

```bash
npm install
```

This pulls in:

* **express** – web server
* **cors** – Cross-Origin Resource Sharing middleware
* **js-yaml** – parses per-lesson YAML metadata

## Running the App

Start the server:

```bash
npm start
```

By default it listens on `http://localhost:3000`. Open that URL in your browser to:

1. Choose a single lesson (or “All Lessons”)
2. See optional `lesson.yaml` metadata (name & subtitle) and rendered `lesson-description.md`
3. Click any sentence (if audio is present) to hear it

The server reads your `lessons/` folder on every request, so updates to `.txt`, `.wav`, `.yaml`, or `.md` files appear immediately.

## Adding or Editing Lessons

Each lesson lives in its own folder under `lessons/`, e.g.:

```
lessons/
└── lesson4/
    ├── lesson4.txt
    ├── lesson4-en.txt
    ├── lesson4-zh.txt        # optional script file
    ├── Sound 01.wav
    ├── lesson.yaml           # optional metadata
    └── lesson-description.md # optional notes
```

* **Text files** must have matching line counts (warnings appear in the console).
* **Audio files** are named `Sound NN.wav` (01–99). Missing files are grayed out.
* **lesson.yaml** (YAML) can define:

  ```yaml
  lesson-name: "My Lesson Title"
  lesson-subtitle: "Brief subtitle or context"
  ```
* **lesson-description.md** is rendered below the heading via \[marked.js].

## Customization

If your naming conventions change, edit the top of **server.js**:

```js
// server.js, CONFIG section
const TXT_PATTERNS = {
  source:      base => `${base}.txt`,
  translation: base => `${base}-en.txt`,
  script:      base => `${base}-zh.txt`,
}
const audioFilename = num =>
  `Sound ${String(num).padStart(2,'0')}.wav`
```

Adjust those patterns to match your file names, then restart the server.


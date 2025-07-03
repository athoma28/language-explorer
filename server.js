const express = require('express')
const cors = require('cors')
const fs = require('fs').promises
const path = require('path')

/**
 * CONFIG: adjust these patterns to match your files
 */
const LESSONS_DIR     = path.join(__dirname, 'lessons')
// folder names like "lesson4", "lesson5", etc.
const LESSON_FOLDER_RE = /^lesson(\d+)$/

// within each folder:
//   source → `${basename}.txt`
//   translation → `${basename}-en.txt`
//   script (optional) → `${basename}-zh.txt`
const TXT_PATTERNS = {
  source:       (base) => `${base}.txt`,
  translation:  (base) => `${base}-en.txt`,
  script:       (base) => `${base}-zh.txt`,
}

// audio files named "Sound xx.wav" (01–99)
const audioFilename = (num) =>
  `Sound ${String(num).padStart(2, '0')}.wav`

/** END CONFIG **/

const app = express()

app.use(cors())
app.use(express.static('public'))
// serve audio files under /audio/lessonX/…
app.use('/audio', express.static(path.join(__dirname, 'lessons')))

app.get('/api/lessons', async (req, res) => {
  try {
    const dirs = await fs.readdir(LESSONS_DIR, { withFileTypes: true })
    const lessons = []

    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue
      const folder = dirent.name
      if (!LESSON_FOLDER_RE.test(folder)) continue

      const lessonPath = path.join(LESSONS_DIR, folder)
      const baseName   = folder  // e.g. "lesson4"

      // read the three possible txt files
      const paths = {
        source:      path.join(lessonPath, TXT_PATTERNS.source(baseName)),
        translation: path.join(lessonPath, TXT_PATTERNS.translation(baseName)),
        script:      path.join(lessonPath, TXT_PATTERNS.script(baseName)),
      }

      // load source + translation (required)
      const [srcText, tgtText] = await Promise.all([
        fs.readFile(paths.source, 'utf8'),
        fs.readFile(paths.translation, 'utf8')
      ]).catch(err => {
        console.error(`✖ Missing required txt in ${folder}:`, err.message)
        throw err
      })

      const sources = srcText.split('\n')
      const targets = tgtText.split('\n')

      // optional script
      let scripts = []
      try {
        const scriptText = await fs.readFile(paths.script, 'utf8')
        scripts = scriptText.split('\n')
      } catch {
        // no script file → leave scripts empty
      }

      if (sources.length !== targets.length) {
        console.warn(`⚠ [${folder}] source/translation line count mismatch:`,
          sources.length, 'vs', targets.length)
      }
      if (scripts.length && scripts.length !== sources.length) {
        console.warn(`⚠ [${folder}] source/script line count mismatch:`,
          sources.length, 'vs', scripts.length)
      }

      const sentences = []
      for (let i = 0; i < Math.max(sources.length, targets.length); i++) {
        const id = i + 1
        const audioPath = path.join(lessonPath, audioFilename(id))
        let hasAudio = true
        try {
          await fs.access(audioPath)
        } catch {
          console.warn(`⚠ [${folder}] missing audio for line ${id}:`, audioFilename(id))
          hasAudio = false
        }
        sentences.push({
          id,
          source:      sources[i] || '',
          translation: targets[i] || '',
          script:      scripts[i] || null,
          audioUrl:    hasAudio ? `/audio/${folder}/${audioFilename(id)}` : null
        })
      }

      lessons.push({ lesson: folder, sentences })
    }

    res.json(lessons)
  } catch (err) {
    console.error('✖ Error building lesson list:', err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(3000, () => {
  console.log('Language Explorer API running on http://localhost:3000')
})

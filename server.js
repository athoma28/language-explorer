// server.js
const express = require('express')
const cors    = require('cors')
const fs      = require('fs').promises
const path    = require('path')
const yaml    = require('js-yaml')

/** CONFIG: tweak naming patterns here **/
const LESSONS_DIR     = path.join(__dirname, 'lessons')
const LESSON_FOLDER_RE = /^lesson(\d+)$/
const TXT_PATTERNS = {
  source:      base => `${base}.txt`,
  translation: base => `${base}-en.txt`,
  script:      base => `${base}-zh.txt`,
}
const audioFilename = num =>
  `Sound ${String(num).padStart(3,'0')}.wav`
/** END CONFIG **/

const app = express()
app.use(cors())
app.use(express.static('public'))
app.use('/audio', express.static(LESSONS_DIR))

app.get('/api/lessons', async (req, res) => {
  try {
    const dirents = await fs.readdir(LESSONS_DIR, { withFileTypes: true })
    const lessons = []

    for (const d of dirents) {
      if (!d.isDirectory() || !LESSON_FOLDER_RE.test(d.name)) continue
      const folder = d.name
      const base   = folder
      const dir    = path.join(LESSONS_DIR, folder)

      // 1) load optional metadata
      let meta = { name: folder, subtitle: '' }
      try {
        const yml = await fs.readFile(path.join(dir,'lesson.yaml'),'utf8')
        const doc = yaml.load(yml)
        meta.name     = doc['lesson-name']     || meta.name
        meta.subtitle = doc['lesson-subtitle'] || ''
      } catch {}

      // 2) load optional markdown description
      let description = ''
      try {
        description = await fs.readFile(
          path.join(dir,'lesson-description.md'),
          'utf8'
        )
      } catch {}

      // 3) load source & translation
      const srcPath = path.join(dir, TXT_PATTERNS.source(base))
      const tgtPath = path.join(dir, TXT_PATTERNS.translation(base))
      const [srcTxt, tgtTxt] = await Promise.all([
        fs.readFile(srcPath,'utf8'),
        fs.readFile(tgtPath,'utf8')
      ]).catch(err => {
        console.error(`Missing txt in ${folder}:`, err.message)
        throw err
      })
      const sources = srcTxt.split('\n')
      const targets = tgtTxt.split('\n')

      // 4) optional script
      let scripts = []
      try {
        const sc = await fs.readFile(
          path.join(dir, TXT_PATTERNS.script(base)),
          'utf8'
        )
        scripts = sc.split('\n')
      } catch {}

      if (sources.length !== targets.length) {
        console.warn(`[${folder}] src/tgt line mismatch:`,
          sources.length, 'vs', targets.length)
      }
      if (scripts.length && scripts.length !== sources.length) {
        console.warn(`[${folder}] src/script line mismatch:`,
          sources.length, 'vs', scripts.length)
      }

      // 5) build sentences array
      const sentences = []
      const max = Math.max(sources.length, targets.length)
      for (let i = 0; i < max; i++) {
        const id = i+1
        const file = path.join(dir, audioFilename(id))
        let hasAudio = true
        try { await fs.access(file) }
        catch {
          console.warn(`[${folder}] missing audio ${audioFilename(id)}`)
          hasAudio = false
        }
        sentences.push({
          id,
          source:      sources[i] || '',
          translation: targets[i] || '',
          script:      scripts[i] || null,
          audioUrl:    hasAudio
            ? `/audio/${folder}/${audioFilename(id)}`
            : null
        })
      }

      lessons.push({ folder, meta, description, sentences })
    }

    res.json(lessons)
  } catch (err) {
    console.error('Error:', err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(3000, () =>
  console.log('Listening on http://localhost:3000')
)

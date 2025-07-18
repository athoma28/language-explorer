const express = require('express')
const cors    = require('cors')
const fs      = require('fs').promises
const path    = require('path')
const yaml    = require('js-yaml')

const CONFIG_PATH = path.join(__dirname, 'lesson-config.yaml')
const app         = express()

app.use(cors())
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})
// serve *all* files under project root at /audio/...
app.use('/audio', express.static(__dirname))

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8')
  return yaml.load(raw)
}

app.get('/api/lessons', async (req, res) => {
  try {
    const cfg     = await loadConfig()
    const lessons = []

    for (const entry of cfg.lessons) {
      // required fields
      if (!entry.name || !entry.path || !entry.source || !entry.target) {
        console.warn('Skipping incomplete lesson entry:', entry)
        continue
      }

      // read optional description
      let description = ''
      if (entry.descriptionFile) {
        try {
          description = await fs.readFile(
            path.join(__dirname, entry.descriptionFile),
            'utf8'
          )
        } catch (err) {
          console.warn(`Could not read descriptionFile for '${entry.name}':`, err.message)
        }
      }

      // load source & target text
      const [srcTxt, tgtTxt] = await Promise.all([
        fs.readFile(path.join(__dirname, entry.source), 'utf8'),
        fs.readFile(path.join(__dirname, entry.target), 'utf8'),
      ]).catch(err => {
        console.error(`Error reading text files for '${entry.name}':`, err.message)
        throw err
      })

      const sources = srcTxt.split('\n')
      const targets = tgtTxt.split('\n')

      // optional transcription
      let transLines = []
      if (entry.transcription) {
        try {
          const trTxt = await fs.readFile(
            path.join(__dirname, entry.transcription),
            'utf8'
          )
          transLines = trTxt.split('\n')
        } catch (err) {
          console.warn(`Could not read transcription for '${entry.name}':`, err.message)
        }
      }

      // collect + sort all audio in entry.path
      const audioDir = path.join(__dirname, entry.path)
      let audioFiles = []
      try {
        const allFiles = await fs.readdir(audioDir)
        audioFiles = allFiles
          .filter(f => f.match(/\.(wav|mp3)$/i))
          .sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          )
      } catch (err) {
        console.warn(`Could not read audioDir for '${entry.name}':`, err.message)
      }

      const count = Math.max(sources.length, targets.length, audioFiles.length)
      const sentences = []

      for (let i = 0; i < count; i++) {
        sentences.push({
          id:            i + 1,
          source:        sources[i]    || '',
          target:        targets[i]    || '',
          transcription: transLines[i] || null,
          audioUrl:      audioFiles[i]
                          ? `/audio/${path.join(entry.path, audioFiles[i])}`
                          : null
        })
      }

      lessons.push({
        name:        entry.name,
        subtitle:    entry.subtitle    || '',
        description: description,
        sentences
      })
    }

    res.json(lessons)
  } catch (err) {
    console.error('Failed to build lessons:', err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(3000, () =>
  console.log('⚡ Listening on http://localhost:3000')
)

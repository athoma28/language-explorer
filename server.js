const express = require('express')
const cors    = require('cors')
const fs      = require('fs').promises
const path    = require('path')
const yaml    = require('js-yaml')

const CONFIG_PATH = path.join(__dirname, 'config.json')
const LESSONS_DIR = path.join(__dirname, 'lessons')

async function loadConfig() {
  const txt = await fs.readFile(CONFIG_PATH, 'utf8')
  return JSON.parse(txt)
}

async function saveConfig(cfg) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
}

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public'))
app.use('/audio', express.static(LESSONS_DIR))

// ==== CONFIG ENDPOINTS ====

app.get('/api/config', async (req, res) => {
  try {
    const cfg = await loadConfig()
    res.json(cfg)
  } catch (e) {
    console.error('Failed to load config:', e)
    res.status(500).send('Could not load config')
  }
})

app.post('/api/config', async (req, res) => {
  try {
    await saveConfig(req.body)
    res.sendStatus(204)
  } catch (e) {
    console.error('Failed to save config:', e)
    res.status(500).send('Could not save config')
  }
})

// ==== LESSONS ENDPOINT ====

app.get('/api/lessons', async (req, res) => {
  try {
    const cfg        = await loadConfig()
    const folderRE   = new RegExp(cfg.lessonFolderRegex)
    const txtTpls    = cfg.txtPatterns
    const audioTpl   = cfg.audioPattern

    const dirents = await fs.readdir(LESSONS_DIR, { withFileTypes: true })
    const lessons = []

    for (const d of dirents) {
      if (!d.isDirectory() || !folderRE.test(d.name)) continue

      const folder = d.name
      const base   = folder
      const dir    = path.join(LESSONS_DIR, folder)

      // metadata & description as before…
      let meta = { name: folder, subtitle: '' }
      try {
        const yml = await fs.readFile(path.join(dir,'lesson.yaml'),'utf8')
        Object.assign(meta, yaml.load(yml))
      } catch {}

      let description = ''
      try {
        description = await fs.readFile(
          path.join(dir,'lesson-description.md'),
          'utf8'
        )
      } catch {}

      // read source + translation
      const [srcTxt, tgtTxt] = await Promise.all([
        fs.readFile(path.join(dir, txtTpls.source.replace(/\$\{base\}/g, base)), 'utf8'),
        fs.readFile(path.join(dir, txtTpls.translation.replace(/\$\{base\}/g, base)), 'utf8'),
      ])

      const sources = srcTxt.split('\n')
      const targets = tgtTxt.split('\n')

      // optional script
      let scripts = []
      try {
        const sc = await fs.readFile(
          path.join(dir, txtTpls.script.replace(/\$\{base\}/g, base)),
          'utf8'
        )
        scripts = sc.split('\n')
      } catch {}

      const sentences = []
      const count = Math.max(sources.length, targets.length)
      for (let i = 0; i < count; i++) {
        const num       = String(i+1).padStart(3, '0')
        const audioName = audioTpl.replace(/\$\{num\}/g, num)
        const audioPath = path.join(dir, audioName)
        let hasAudio = true
        try { await fs.access(audioPath) } catch { hasAudio = false }

        sentences.push({
          id:          i+1,
          source:      sources[i] || '',
          translation: targets[i] || '',
          script:      scripts[i] || null,
          audioUrl:    hasAudio ? `/audio/${folder}/${audioName}` : null
        })
      }

      lessons.push({ folder, meta, description, sentences })
    }

    res.json(lessons)
  } catch (err) {
    console.error(err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(3000, () =>
  console.log('Server running on http://localhost:3000')
)

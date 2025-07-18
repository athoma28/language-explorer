#!/usr/bin/env node
// build-lessons.js
// Usage:
//   # local dev (ignore audioBaseUrl)
//   node build-lessons.js
//
//   # production build (set & persist audioBaseUrl)
//   node build-lessons.js --audio-base-url https://cdn.example.com/assets

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

const CONFIG_PATH = path.join(process.cwd(), 'lesson-config.yaml')
const PUBLIC_DIR  = path.join(process.cwd(), 'public')
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'lessons.json')

// 1. parse CLI args
const argv = process.argv.slice(2)
let prodBase = null
const idx = argv.indexOf('--audio-base-url')
if (idx !== -1 && argv[idx+1]) {
  prodBase = argv[idx+1]
}

// 2. load config
let config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'))

// 3. if production flag set, write back to YAML
if (prodBase) {
  config.audioBaseUrl = prodBase
  fs.writeFileSync(
    CONFIG_PATH,
    yaml.dump(config, { lineWidth: 1000 }),
    'utf8'
  )
  console.log(`🔧 Updated audioBaseUrl in lesson-config.yaml → ${prodBase}`)
} else {
  console.log(`🛠️  Local dev build; ignoring audioBaseUrl`)
}

// 4. ensure public dir exists
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR)

// 5. assemble lessons.json
const lessons = config.lessons.map(entry => {
  // required checks
  if (!entry.name || !entry.path || !entry.source || !entry.target) {
    console.warn(`⚠️  Skipping incomplete lesson entry: ${entry.name}`)
    return null
  }

  // read text lines
  const readLines = file =>
    fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').split('\n')
      : []

  const sources = readLines(path.join(process.cwd(), entry.source))
  const targets = readLines(path.join(process.cwd(), entry.target))
  const trans  = entry.transcription
    ? readLines(path.join(process.cwd(), entry.transcription))
    : []

  // collect & sort audio files
  const audioDir = path.join(process.cwd(), entry.path)
  let audioFiles = []
  if (fs.existsSync(audioDir)) {
    audioFiles = fs
      .readdirSync(audioDir)
      .filter(f => f.match(/\.(wav|mp3)$/i))
      .sort((a,b) =>
        a.localeCompare(b, undefined, { numeric: true })
      )
  }

  // build sentences
  const count = Math.max(sources.length, targets.length, audioFiles.length)
  const sentences = Array.from({ length: count }, (_, i) => {
    const relPath = `${entry.path}/${audioFiles[i] || ''}`
    const url = audioFiles[i]
      ? (prodBase
          ? `${config.audioBaseUrl.replace(/\/$/, '')}/${relPath}`
          : `/${relPath}`)
      : null

    return {
      id:            i+1,
      source:        sources[i]    || '',
      target:        targets[i]    || '',
      transcription: trans[i]      || null,
      audioUrl:      url
    }
  })

  return {
    name:        entry.name,
    subtitle:    entry.subtitle || '',
    description: entry.descriptionFile
                   ? fs.readFileSync(
                       path.join(process.cwd(), entry.descriptionFile),
                       'utf8'
                     )
                   : '',
    sentences
  }
})
.filter(x => x !== null)

// 6. write out JSON
fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(lessons, null, 2),
  'utf8'
)
console.log(`✅ Built ${lessons.length} lessons → public/lessons.json`)

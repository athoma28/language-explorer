#!/usr/bin/env node
// build-lessons.js
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'

const CONFIG_PATH = path.join(process.cwd(), 'lesson-config.yaml')
const PUBLIC_DIR  = path.join(process.cwd(), 'public')
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'lessons.json')

async function getAudioFiles(lessonPath, isProd, audioBaseUrl) {
  if (!isProd) {
    const localAudioDir = path.join(process.cwd(), lessonPath)
    if (!fs.existsSync(localAudioDir)) return []
    return fs
      .readdirSync(localAudioDir)
      .filter(f => f.match(/\.(wav|mp3)$/i))
      .sort((a,b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  try {
    const listingUrl = `${audioBaseUrl.replace(/\/$/, '')}/?prefix=${lessonPath.replace(/\/$/, '')}/`
    const response = await axios.get(listingUrl)
    const xmlData = await parseStringPromise(response.data)
    
    if (!xmlData.ListBucketResult || !xmlData.ListBucketResult.Contents) {
      console.error(`❌ No audio files found in GCS for ${lessonPath}`)
      process.exit(1)
    }

    return xmlData.ListBucketResult.Contents
      .map(item => path.basename(item.Key[0]))
      .filter(f => f.match(/\.(wav|mp3)$/i))
      .sort((a,b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch (error) {
    console.error(`❌ Error fetching audio files from GCS for ${lessonPath}:`, error.message)
    process.exit(1)
  }
}

async function readTextFile(filePath, isProd, baseUrl) {
  if (!filePath) return ''

  if (isProd) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/${filePath}`
      const response = await axios.get(url)
      return response.data
    } catch (error) {
      console.error(`❌ Error fetching text file from GCS: ${filePath}`, error.message)
      return ''
    }
  } else {
    const localPath = path.join(process.cwd(), filePath)
    return fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8') : ''
  }
}

async function readLines(filePath, isProd, baseUrl) {
  const content = await readTextFile(filePath, isProd, baseUrl)
  return content ? content.split('\n') : []
}

async function build() {
  // 1. parse CLI args
  const argv = process.argv.slice(2)
  let prodBase = null
  const idx = argv.indexOf('--audio-base-url')
  if (idx !== -1 && argv[idx+1]) {
    prodBase = argv[idx+1]
  }

  // 2. load config
  let config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'))

  // 3. if production flag set, update config
  if (prodBase) {
    config.audioBaseUrl = prodBase
    console.log(`🔧 Building for production with audioBaseUrl → ${prodBase}`)
  } else {
    console.log(`🛠️  Local dev build; ignoring audioBaseUrl`)
  }

  // 4. ensure public dir exists
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR)

  // 5. assemble lessons.json
  const lessonPromises = config.lessons.map(async entry => {
    if (!entry.name || !entry.path || !entry.source || !entry.target) {
      console.warn(`⚠️  Skipping incomplete lesson entry: ${entry.name}`)
      return null
    }

    const sources = await readLines(entry.source, !!prodBase, config.audioBaseUrl)
    const targets = await readLines(entry.target, !!prodBase, config.audioBaseUrl)
    const trans  = entry.transcription
      ? await readLines(entry.transcription, !!prodBase, config.audioBaseUrl)
      : []

    const audioFiles = await getAudioFiles(entry.path, !!prodBase, config.audioBaseUrl)

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
      description: await readTextFile(entry.descriptionFile, !!prodBase, config.audioBaseUrl),
      sentences
    }
  })

  const lessons = (await Promise.all(lessonPromises)).filter(x => x !== null)

  // 6. write out JSON
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(lessons, null, 2),
    'utf8'
  )
  console.log(`✅ Built ${lessons.length} lessons → public/lessons.json`)
}

build().catch(err => {
  console.error("Build failed:", err)
  process.exit(1)
})
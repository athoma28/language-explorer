import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
let lessons = []

async function load() {
  try {
    lessons = await fetch('/api/lessons').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
  } catch (err) {
    console.error('Could not load lessons.json:', err)
    return
  }

  buildLessonSelect()
  wireControls()
  render('all')
}

function buildLessonSelect() {
  const sel = document.getElementById('lessonSelect')
  lessons.forEach((lesson, i) => {
    const o = document.createElement('option')
    o.value = i
    o.textContent = lesson.name;
    sel.append(o)
  })
}

function wireControls() {
  document.getElementById('lessonSelect')
    .addEventListener('change', e => render(e.target.value))
  document.getElementById('search')
    .addEventListener('input', filter)
  document.getElementsByName('field')
    .forEach(r => r.addEventListener('change', filter))
}

function render(val) {
  const container = document.getElementById('content')
  container.innerHTML = ''

  const toRender = (val === 'all')
    ? lessons
    : [lessons[val]]

  toRender.forEach(lesson => {
    // header
    const sec = document.createElement('section')
    sec.innerHTML = `
      <h2>${lesson.name}</h2>
      ${lesson.subtitle ? `<h3>${lesson.subtitle}</h3>` : ''}
      ${lesson.description
         ? `<div class="description">${marked(lesson.description)}</div>`
         : ''}
    `
    container.append(sec)

    // sentences
    lesson.sentences.forEach(s => {
      const d = document.createElement('div')
      d.className = 'sentence'
      if (!s.audioUrl) d.classList.add('no-audio')

      if (s.transcription) {
        const tr = document.createElement('div')
        tr.className = 'transcription'
        tr.textContent = s.transcription
        d.append(tr)
      }

      const src = document.createElement('span')
      src.className = 'text source'
      src.textContent = s.source

      const tgt = document.createElement('span')
      tgt.className = 'text target'
      tgt.textContent = s.target    // use .target not .translation

      d.append(src, tgt)

      if (s.audioUrl) {
        d.addEventListener('click', () => {
          const player = document.getElementById('player')
          player.src = s.audioUrl
          player.play().catch(console.error)
        })
      }

      // for filtering
      d.dataset.source = s.source.toLowerCase()
      d.dataset.target = s.target.toLowerCase()

      container.append(d)
    })
  })

  filter()
}

function filter() {
  const q = document.getElementById('search').value.toLowerCase()
  const field = document.querySelector('input[name=field]:checked').value
  document.querySelectorAll('.sentence').forEach(el => {
    const txt = el.dataset[field] || ''
    el.style.display = txt.includes(q) ? '' : 'none'
  })
}

window.addEventListener('DOMContentLoaded', load)

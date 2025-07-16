// public/script.js
let lessons = []

async function load() {
  try {
    lessons = await fetch('/api/lessons').then(r => r.json())
  } catch (e) {
    console.error('Failed to load lessons:', e)
    return
  }

  const sel = document.getElementById('lessonSelect')
  lessons.forEach((L, i) => {
    const o = document.createElement('option')
    o.value = i
    o.textContent = L.meta.name
    sel.append(o)
  })

  sel.addEventListener('change', () => render(sel.value))
  document.getElementById('search')
    .addEventListener('input', filter)
  document.getElementsByName('field')
    .forEach(r => r.addEventListener('change', filter))

  render('all')
}

function render(val) {
  const container = document.getElementById('content')
  container.innerHTML = ''
  if (val === 'all') {
    lessons.forEach(L => renderLesson(L, container))
  } else {
    renderLesson(lessons[val], container)
  }
  filter()
}

function renderLesson({ meta, description, sentences }, parent) {
  const sec = document.createElement('section')
  sec.innerHTML = `
    <h2>${meta.name}</h2>
    ${meta.subtitle ? `<h3>${meta.subtitle}</h3>` : ''}
    ${description ? `<div class="description">${marked(description)}</div>` : ''}
  `
  sentences.forEach(s => {
    const d = document.createElement('div')
    d.className = 'sentence'
    if (!s.audioUrl) d.classList.add('no-audio')
    if (s.script) {
      const sp = document.createElement('div')
      sp.className = 'script'
      sp.textContent = s.script
      d.append(sp)
    }
    const src = document.createElement('span')
    src.className = 'text source'
    src.textContent = s.source
    const tgt = document.createElement('span')
    tgt.className = 'text translation'
    tgt.textContent = s.translation
    d.append(src, tgt)

    if (s.audioUrl) {
      d.addEventListener('click', () => {
        const p = document.getElementById('player')
        p.src = s.audioUrl
        p.play().catch(e => console.error('Audio error:', e))
      })
    }

    // store for filtering
    d.dataset.source      = s.source.toLowerCase()
    d.dataset.translation = s.translation.toLowerCase()

    sec.append(d)
  })
  parent.append(sec)
}

function filter() {
  const q     = document.getElementById('search').value.toLowerCase()
  const field = document.querySelector('input[name=field]:checked').value
  document.querySelectorAll('.sentence').forEach(el => {
    el.style.display = el.dataset[field].includes(q) ? '' : 'none'
  })
}

window.addEventListener('DOMContentLoaded', load)

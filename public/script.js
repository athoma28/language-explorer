let lessons = []

async function load() {
  [lessons, config] = await Promise.all([
    fetch('/api/lessons').then(r => r.json()),
    fetch('/api/config').then(r => r.json())
  ])
  buildLessonSelect()
  wireControls()
  render('all')
  initSettingsModal(config)
}

function buildLessonSelect() {
  const sel = document.getElementById('lessonSelect')
  lessons.forEach((L,i) => {
    const o = document.createElement('option')
    o.value = i
    o.textContent = L.meta.name
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
  document.getElementById('openSettings')
    .addEventListener('click', () => showModal(true))
}

function render(val) {
  const container = document.getElementById('content')
  container.innerHTML = ''
  if (val === 'all') lessons.forEach(L => renderLesson(L,container))
  else renderLesson(lessons[val], container)
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
        p.play().catch(console.error)
      })
    }

    d.dataset.source      = s.source.toLowerCase()
    d.dataset.translation = s.translation.toLowerCase()
    sec.append(d)
  })
  parent.append(sec)
}

function filter() {
  const q = document.getElementById('search').value.toLowerCase()
  const f = document.querySelector('input[name=field]:checked').value
  document.querySelectorAll('.sentence')
    .forEach(el => el.style.display = el.dataset[f].includes(q) ? '' : 'none')
}

// ---- SETTINGS PANEL LOGIC ----

let currentConfig

function initSettingsModal(cfg) {
  currentConfig = cfg
  // populate inputs
  document.getElementById('cfgFolderRE').value = cfg.lessonFolderRegex
  document.getElementById('cfgSource').value   = cfg.txtPatterns.source
  document.getElementById('cfgTranslation').value = cfg.txtPatterns.translation
  document.getElementById('cfgScript').value   = cfg.txtPatterns.script
  document.getElementById('cfgAudio').value    = cfg.audioPattern

  document.getElementById('saveSettings')
    .addEventListener('click', async () => {
      const newCfg = {
        lessonFolderRegex: document.getElementById('cfgFolderRE').value,
        txtPatterns: {
          source:      document.getElementById('cfgSource').value,
          translation: document.getElementById('cfgTranslation').value,
          script:      document.getElementById('cfgScript').value
        },
        audioPattern: document.getElementById('cfgAudio').value
      }
      await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newCfg)
      })
      showModal(false)
      location.reload()  // reload to pick up new config
    })

  document.getElementById('cancelSettings')
    .addEventListener('click', () => showModal(false))
}

function showModal(on) {
  document.getElementById('settingsModal').style.display = on ? 'flex' : 'none'
}

window.addEventListener('DOMContentLoaded', load)

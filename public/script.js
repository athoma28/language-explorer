let lessons = []
let current = []

async function load() {
  try {
    lessons = await fetch('/api/lessons').then(r => r.json())
  } catch (err) {
    console.error('Failed to load lessons:', err)
    return
  }

  const select = document.getElementById('lessonSelect')
  lessons.forEach((l, i) => {
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = l.lesson
    select.append(opt)
  })

  select.addEventListener('change', () => render(+select.value))
  document.getElementById('search')
    .addEventListener('input', filter)
  document.getElementsByName('field')
    .forEach(r => r.addEventListener('change', filter))

  render(0)
}

function render(idx) {
  const container = document.getElementById('content')
  container.innerHTML = ''
  current = lessons[idx]?.sentences || []

  current.forEach(s => {
    const div = document.createElement('div')
    div.className = 'sentence'
    if (!s.audioUrl) div.classList.add('no-audio')

    // optional script line
    const scriptHtml = s.script
      ? `<div class="script">${s.script}</div>`
      : ''

    div.innerHTML = `
      ${scriptHtml}
      <span class="text source">${s.source}</span>
      <span class="text translation">${s.translation}</span>
    `
    if (s.audioUrl) {
      div.addEventListener('click', () => {
        const player = document.getElementById('player')
        player.src = s.audioUrl
        player.play().catch(e => console.error('Audio play failed:', e))
      })
    }
    container.append(div)
  })

  filter()
}

function filter() {
  const q = document.getElementById('search').value.toLowerCase()
  const field = document.querySelector('input[name=field]:checked').value

  document.querySelectorAll('.sentence').forEach((el, i) => {
    const txt = (current[i][field] || '').toLowerCase()
    el.style.display = txt.includes(q) ? '' : 'none'
  })
}

window.addEventListener('DOMContentLoaded', load)

const canvas = document.getElementById("backgroundCanvas")
const ctx = canvas.getContext("2d")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

let mouseX = canvas.width / 2
let mouseY = canvas.height / 2

const particles = []
const particleCount = 80

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width
    this.y = Math.random() * canvas.height
    this.size = Math.random() * 2 + 0.5
    this.speedX = Math.random() * 0.5 - 0.25
    this.speedY = Math.random() * 0.5 - 0.25
    this.opacity = Math.random() * 0.5 + 0.2
  }

  update() {
    const dx = mouseX - this.x
    const dy = mouseY - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxDistance = 200

    if (distance < maxDistance) {
      const force = (maxDistance - distance) / maxDistance
      this.x -= (dx / distance) * force * 2
      this.y -= (dy / distance) * force * 2
    }

    this.x += this.speedX
    this.y += this.speedY

    if (this.x < 0 || this.x > canvas.width) this.speedX *= -1
    if (this.y < 0 || this.y > canvas.height) this.speedY *= -1
  }

  draw() {
    ctx.fillStyle = `rgba(255, 215, 0, ${this.opacity})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle())
}

function animate() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  particles.forEach((particle) => {
    particle.update()
    particle.draw()
  })

  particles.forEach((particle, i) => {
    particles.slice(i + 1).forEach((otherParticle) => {
      const dx = particle.x - otherParticle.x
      const dy = particle.y - otherParticle.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 100) {
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.15 * (1 - distance / 100)})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(particle.x, particle.y)
        ctx.lineTo(otherParticle.x, otherParticle.y)
        ctx.stroke()
      }
    })
  })

  requestAnimationFrame(animate)
}

animate()

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX
  mouseY = e.clientY
})

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
})

function showError(message) {
  alert(message)
}

function showLoading(show) {
  const btn = document.querySelector(".submit-button")
  if (show) {
    btn.disabled = true
    btn.textContent = "Carregando..."
  } else {
    btn.disabled = false
    btn.innerHTML = '<span class="button-text">Entrar</span><svg class="button-icon" width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
}

async function handleSubmit(event) {
  event.preventDefault()

  const username = document.getElementById("username").value.trim()
  const password = document.getElementById("password").value.trim()

  if (!username || !password) {
    showError("Preencha todos os campos")
    return
  }

  showLoading(true)

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    })

    const data = await response.json()

    if (!response.ok) {
      showError(data.error || "Erro ao fazer login")
      showLoading(false)
      return
    }

    localStorage.setItem("token", data.token)
    localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario))

    window.location.href = "/dashboard"
  } catch (error) {
    showError("Erro de conexão com o servidor")
    showLoading(false)
  }
}

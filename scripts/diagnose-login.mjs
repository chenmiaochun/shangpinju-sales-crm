const ports = [5173, 3001]
for (const port of ports) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'GET', signal: AbortSignal.timeout(5000) })
    console.log(`port ${port}: HTTP ${res.status}`)
  } catch (e) {
    console.log(`port ${port}: error ${e.message}`)
  }
}

try {
  const res = await fetch('http://127.0.0.1:3001/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'spj008', password: 'wrong' }),
    signal: AbortSignal.timeout(5000),
  })
  const text = await res.text()
  console.log('login POST HTTP', res.status, text.slice(0, 200))
} catch (e) {
  console.log('login POST error', e.message)
}

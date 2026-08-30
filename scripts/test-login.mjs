const res = await fetch('http://127.0.0.1:3001/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://127.0.0.1:5173',
  },
  body: JSON.stringify({ username: 'spj008', password: 'wrong' }),
})
const text = await res.text()
console.log('HTTP', res.status, text.slice(0, 200))

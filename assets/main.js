// 1 check printer status (logged in or not)
// 2 if logged in, show panel else show login form
// 3 check

const init = async () => {
  setInterval(async () => {
    await checkStatus()
  }, 1000)
  await getSettings()
  await checkStatus()
  document.querySelector('.loader').style.display = 'none'
  document.getElementById('btnUpdate').addEventListener('click', async () => {
    await applySettings()
  })
}

const checkStatus = async () => {
  const response = await fetch('/api/status')
  const { status } = await response.json()
  if (status) {
    document.querySelector('.status').textContent = 'connected'
    document.querySelector('.status').classList.remove('error')
    document.querySelector('.status').classList.add('success')
    await getPrinters()
  } else {
    document.querySelector('.status').textContent = 'not connected'
    document.querySelector('.status').classList.remove('success')
    document.querySelector('.status').classList.add('error')
    document.getElementById('printers').innerHTML = ''
  }

  return status
}

const getPrinters = async () => {
  const response = await fetch('/api/printers')
  const printers = await response.json()
  document.getElementById('printers').innerHTML = ''
  let html = ''
  printers.forEach(printer => {
    html += `<tr>
      <td>${printer.id}</td>
      <td>${printer.name}</td>
      <td>${printer.location}</td>
      <td>${printer.type}</td>
      <td>${printer.address}</td>
      <td>${printer.port}</td>
    </tr>
      `
  })
  document.getElementById('printers').innerHTML = html
}

const getSettings = async () => {
  const response = await fetch('/api/settings')
  const { apiHost, apiKey } = await response.json()
  document.getElementById('apiHost').value = apiHost
  document.getElementById('apiKey').value = apiKey
}

const applySettings = async () => {
  const apiHost = document.getElementById('apiHost').value
  const apiKey = document.getElementById('apiKey').value
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiHost, apiKey }),
  })
  return await response.json()
}

document.addEventListener('DOMContentLoaded', init)

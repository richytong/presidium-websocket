# presidium-websocket
Presidium WebSocket Client and Server for [Node.js](https://nodejs.org/en).

```javascript
const WebSocket = require('presidium-websocket')

// server
const server = new WebSocket.Server(websocket => {
  websocket.on('message', message => {
    console.log('Got message:', message)
  })
  websocket.on('close', () => {
    console.log('websocket closed')
  })
})

server.listen(1337, () => {
  console.log('WebSocket server listening on port 1337')
})

// client
const websocket = new WebSocket('ws://localhost:1337/')

websocket.addEventListener('open', function (event) {
  websocket.send('Hello Server!')
})
websocket.addEventListener('message', function (event) {
  console.log('Message from server:', event.data)
})
```

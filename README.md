# presidium-websocket
Presidium WebSocket Client and Server for [Node.js](https://nodejs.org/en).

```javascript
const WebSocket = require('presidium-websocket')

// server
const server = new WebSocket.Server(websocket => {
  websocket.on('message', message => {
    console.log('Message from client:', message)
    websocket.send('pong')
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

websocket.on('open', () => {
  websocket.send('ping')
})
websocket.on('message', message => {
  console.log('Message from server:', message)
})
```

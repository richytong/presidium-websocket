const WebSocketServer = require('./WebSocketServer')
// const WebSocket = require('ws')
const WebSocket = require('.')
const http = require('http')
const testPayload = require('./test-payload.json')

const server = new WebSocketServer(websocket => {
  websocket.on('message', message => {
    console.log('send')
    websocket.send(message)
  })
}, { supportPerMessageDeflate: true })

server.listen(7357)

const websocket = new WebSocket('ws://localhost:7357/')

websocket.on('open', () => {
  console.log(websocket._perMessageDeflate)
  // websocket.send(testPayload)
  websocket.send('test-message')
})

websocket.on('message', message => {
  console.log(message.toString('utf8')) // *I-.��M-.NLO
})

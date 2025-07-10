const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('ws')
// const WebSocket = require('.')
const http = require('http')
const testPayload = require('./test-payload.json')

/*
const server = new WebSocketServer(websocket => {
  console.log('permessage-deflate', websocket._perMessageDeflate)
  websocket.on('message', message => {
    console.log('send')
    websocket.send(message)
  })
}, { supportPerMessageDeflate: true })

server.listen(7357)
*/

const websocket = new WebSocket('ws://localhost:7357/', {
  // requestPerMessageDeflate: false
})

websocket.on('open', () => {
  // websocket.send(testPayload)
  websocket.send('1')
})

websocket.on('message', message => {
  console.log('received:', message.toString('utf8')) // *I-.��M-.NLO
})

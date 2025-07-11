const WebSocket = require('presidium-websocket')
const WSWebSocket = require('ws')

const server = new WSWebSocket.Server({
  port: 7357,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
  }
})

server.on('connection', websocket => {
  websocket.on('message', message => {
    console.log('server send', message.toString('utf8'))
    websocket.send(message)
  })
})

const websocket = new WebSocket('ws://localhost:7357/')

websocket.on('open', () => {
  const message = '1'
  console.log('client send', message)
  websocket.send(message)
})

websocket.on('message', message => {
  console.log('client receive', message.toString('utf8'))
})

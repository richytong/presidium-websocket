const WebSocket = require('.')
// const WebSocket = require('ws')
const testPayload = require('./test-payload.json')

/*
const server = new WebSocket.Server(websocket => {
  websocket.on('message', message => {
    websocket.send(message)
  })
}, { perMessageDeflate: true })

server.listen(7357)
*/

const websocket = new WebSocket('ws://localhost:7357/', {
  // perMessageDeflate: false,
})

websocket.on('open', () => {
  // console.log(websocket)
  websocket.send(testPayload)
})

websocket.on('message', message => {
  console.log('message', message.toString('utf8'))
})

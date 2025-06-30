const assert = require('assert')
const Http = require('presidium/Http')
const sleep = require('./_internal/sleep')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('./WebSocket')

describe('WebSocketServer, WebSocket', () => {
  it('Integration', async () => {
    {
      let didRequest = false

      const server = new WebSocketServer()
      server.listen(7357, () => {
        console.log('server listening on port 7357')
      })
      server.on('request', () => {
        didRequest = true
      })

      const http = new Http('http://localhost:7357')
      const response = await http.get('http://localhost:7357')

      assert(didRequest)
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'OK')
      server.close()
    }

    await sleep(100)

    {
      let resolve
      const promise = new Promise(_resolve => {
        resolve = _resolve
      })

      let didRequest = false
      let didUpgrade = false
      const messages = []

      const server = new WebSocketServer(websocket => {
        websocket.on('message', message => {
          assert.equal(server.clients.size, 1)
          messages.push(message.toString('utf8'))
          websocket.send('pong')
        })

        websocket.on('close', () => {
          server.close()
        })
      })

      server.on('request', () => {
        didRequest = true
      })

      server.on('upgrade', () => {
        didUpgrade = true
      })

      server.on('close', resolve)

      server.listen(7357, () => {
        console.log('server listening on port 7357')
      })

      const websocket = new WebSocket('ws://localhost:7357')

      websocket.on('message', message => {
        messages.push(message)
        websocket.close()
      })

      websocket.on('open', () => {
        websocket.send('ping')
      })

      await promise
      assert(!didRequest)
      assert(didUpgrade)
      assert.equal(messages.length, 2)
      assert.equal(messages[0], 'ping')
      assert.equal(messages[1], 'pong')
      server.close()
    }
  }).timeout(10000)
})

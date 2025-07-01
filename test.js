const assert = require('assert')
const Http = require('presidium/Http')
const sleep = require('./_internal/sleep')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('./WebSocket')

describe('WebSocketServer, WebSocket', () => {
  it('Handles HTTP with 200 OK by default', async () => {
    let didRequest = false

    const server = new WebSocketServer()
    assert.equal(server._websocketHandler.name, 'noop')
    assert.equal(server._httpHandler.name, 'defaultHttpHandler')
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

    // coverage
    const testHandler = () => {}
    const server2 = new WebSocketServer(undefined, {
      httpHandler: testHandler
    })
    assert.equal(server2._websocketHandler.name, 'noop')
    assert.equal(server2._httpHandler, testHandler)

    const server3 = new WebSocketServer(undefined, {})
    assert.equal(server3._websocketHandler.name, 'noop')
    assert.equal(server3._httpHandler.name, 'defaultHttpHandler')

    await sleep(100)
  }).timeout(10000)

  it('Handles HTTP with an optional httpHandler', async () => {
    let didRequest = false

    const server = new WebSocketServer({
      httpHandler(request, response) {
        response.writeHead(426, {
          'Content-Type': 'text/plain',
        })
        response.end('Upgrade Required')
      }
    })
    server.listen(7357, () => {
      console.log('server listening on port 7357')
    })

    const http = new Http('http://localhost:7357')
    const response = await http.get('http://localhost:7357')

    assert.equal(response.status, 426)
    assert.equal(await response.text(), 'Upgrade Required')
    server.close()

    await sleep(100)
  })

  xit('Handles HTTPS with ssl, key, and cert options', async () => {
  })

  it('Minimal WebSocketServer and WebSocket text exchange', async () => {
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
        messages.push(message)
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

    server.on('close', () => {
      resolve()
    })

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
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].toString('utf8'), 'ping')
    assert.equal(messages[1].toString('utf8'), 'pong')
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('WebSocket error when wrong protocol', async () => {
    assert.throws(
      () => new WebSocket('http://localhost:4507/'),
      new Error('URL protocol must be "ws" or "wss"'),
    )
  })

})

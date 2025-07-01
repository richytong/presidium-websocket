const assert = require('assert')
const Http = require('presidium/Http')
const net = require('net')
const http = require('http')
const sleep = require('./_internal/sleep')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('./WebSocket')

describe('WebSocketServer, WebSocket', () => {
  it('Handles HTTP with 200 OK by default', async () => {
    let didRequest = false

    const server = new WebSocketServer()
    assert.equal(server._websocketHandler.name, 'noop')
    assert.equal(server._httpHandler.name, 'defaultHttpHandler')
    server.listen(7357)
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
    server.listen(7357)

    const http = new Http('http://localhost:7357')
    const response = await http.get('http://localhost:7357')

    assert.equal(response.status, 426)
    assert.equal(await response.text(), 'Upgrade Required')
    server.close()

    await sleep(100)
  })

  xit('Handles HTTPS with ssl, key, and cert options', async () => {
  })

  it('Bad WebSocket server', async () => {
    const server = http.createServer()

    server.on('upgrade', (request, socket, head) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    })
    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    websocket.on('error', error => {
      websocket.destroy()
      resolve()
    })

    await promise
    server.close()

    await sleep(100)
  })

  it('Bad WebSocket', async () => {
    const server = new WebSocketServer()
    server.listen(7357)

    const socket = net.createConnection(7357, 'localhost', async () => {
      const headers = [
        `GET / HTTP/1.1`,
        `Host: localhost:7357`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        // `Sec-WebSocket-Key: ${key}`, // no key
        'Sec-WebSocket-Version: 13'
      ]
      socket.write(headers.join('\r\n') + '\r\n\r\n')
    })

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const chunks = []
    socket.on('data', chunk => {
      chunks.push(chunk)
    })
    socket.on('end', resolve)

    await promise
    assert.equal(Buffer.concat(chunks).toString('utf8'), 'HTTP/1.1 400 Bad Request\r\n\r\n')

    server.close()
    await sleep(100)
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

    server.listen(7357)

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

  it('Minimal WebSocketServer and WebSocket buffer exchange', async () => {
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
        websocket.send(Buffer.from('pong'))
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send(Buffer.from('ping'))
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

  it('Minimal WebSocketServer and WebSocket 3MB buffer exchange', async () => {
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
        websocket.send(Buffer.alloc(3 * 1024 * 1024))
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send(Buffer.alloc(3 * 1024 * 1024))
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].length, 3 * 1024 * 1024)
    assert.equal(messages[1].length, 3 * 1024 * 1024)
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('Minimal WebSocketServer and WebSocket 65535 Byte buffer exchange', async () => {
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
        websocket.send(Buffer.alloc(65535))
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send(Buffer.alloc(65535))
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].length, 65535)
    assert.equal(messages[1].length, 65535)
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('Minimal WebSocketServer and WebSocket uint8Array exchange', async () => {
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
        websocket.send(new Uint8Array([4, 5, 6]))
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send(new Uint8Array([1, 2, 3]))
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0][0], 1)
    assert.equal(messages[0][1], 2)
    assert.equal(messages[0][2], 3)
    assert.equal(messages[1][0], 4)
    assert.equal(messages[1][1], 5)
    assert.equal(messages[1][2], 6)
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('WebSocket error: Send can only process binary or text frames', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []
    const errors = []

    const server = new WebSocketServer(websocket => {
      websocket.on('message', message => {
        assert.equal(server.clients.size, 1)
        messages.push(message)
        websocket.send(new Uint8Array([4, 5, 6]))
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('error', error => {
      errors.push(error)
      resolve()
    })

    websocket.on('open', () => {
      websocket.send(1)
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 0)
    assert.equal(errors.length, 1)
    assert.deepEqual(errors[0], new TypeError('send can only process binary or text frames'))
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('Server WebSocket error: Send can only process binary or text frames', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []
    const errors = []

    const server = new WebSocketServer(websocket => {
      websocket.on('message', message => {
        assert.equal(server.clients.size, 1)
        messages.push(message)
        websocket.send(1)
      })

      websocket.on('error', error => {
        errors.push(error)
        resolve()
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

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('error', error => {
      errors.push(error)
      resolve()
    })

    websocket.on('open', () => {
      websocket.send('abc')
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].toString('utf8'), 'abc')
    assert.equal(errors.length, 1)
    assert.deepEqual(errors[0], new TypeError('send can only process binary or text frames'))
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

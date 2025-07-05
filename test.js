const assert = require('assert')
const Http = require('presidium/Http')
const net = require('net')
const fs = require('fs')
const http = require('http')
const https = require('https')
const zlib = require('zlib')
const sleep = require('./_internal/sleep')
const encodeWebSocketFrame = require('./_internal/encodeWebSocketFrame')
const WebSocket = require('.')

describe('WebSocket.Server, WebSocket', () => {
  it('WebSocket.Server handles HTTP with 200 OK by default', async () => {
    let didRequest = false

    const server = new WebSocket.Server()
    assert.equal(server._websocketHandler.name, 'noop')
    assert.equal(server._httpHandler.name, 'defaultHttpHandler')
    server.listen(7357)
    server.on('request', () => {
      didRequest = true
    })

    const http = new Http('http://localhost:7357')
    const response = await http.get('/')

    assert(didRequest)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    server.close()

    // coverage
    const testHandler = () => {}
    const server2 = new WebSocket.Server(undefined, {
      httpHandler: testHandler
    })
    assert.equal(server2._websocketHandler.name, 'noop')
    assert.equal(server2._httpHandler, testHandler)

    const server3 = new WebSocket.Server(undefined, {})
    assert.equal(server3._websocketHandler.name, 'noop')
    assert.equal(server3._httpHandler.name, 'defaultHttpHandler')

    await sleep(100)
  }).timeout(10000)

  it('WebSocket.SecureServer handles HTTPS with 200 OK by default', async () => {
    let didRequest = false

    const server = new WebSocket.SecureServer({
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })
    assert.equal(server._websocketHandler.name, 'noop')
    assert.equal(server._httpHandler.name, 'defaultHttpHandler')

    let resolve0
    const promise0 = new Promise(_resolve => {
      resolve0 = _resolve
    })
    server.listen(7357, () => {
      resolve0()
    })
    await promise0

    server.on('request', () => {
      didRequest = true
    })

    let resolve1
    const promise1 = new Promise(_resolve => {
      resolve1 = _resolve
    })

    const request = https.request({
      hostname: 'localhost',
      protocol: 'https:',
      port: 7357,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false
    }, resolve1)
    request.end()

    const response = await promise1

    let resolve2
    const promise2 = new Promise(_resolve => {
      resolve2 = _resolve
    })

    const chunks = []
    response.on('data', chunk => {
      chunks.push(chunk)
    })
    response.on('end', () => {
      resolve2(chunks.map(chunk => chunk.toString('utf8')).join(''))
    })

    const responseBodyText = await promise2

    assert.equal(response.statusCode, 200)
    assert.equal(responseBodyText, 'OK')
    assert(didRequest)

    server.close()

    // coverage
    const testHandler = () => {}
    const server2 = new WebSocket.SecureServer(undefined, {
      httpHandler: testHandler,
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })
    assert.equal(server2._websocketHandler.name, 'noop')
    assert.equal(server2._httpHandler, testHandler)

    const server3 = new WebSocket.Server(undefined, {
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })
    assert.equal(server3._websocketHandler.name, 'noop')
    assert.equal(server3._httpHandler.name, 'defaultHttpHandler')

    await sleep(100)
  }).timeout(10000)

  it('WebSocket.SecureServer with encrypted private key handles HTTPS with 200 OK by default', async () => {
    let didRequest = false

    const server = new WebSocket.SecureServer({
      cert: fs.readFileSync('./test/localhost-encrypted.crt'),
      key: fs.readFileSync('./test/localhost-encrypted.key'),
      passphrase: 'passphrase'
    })
    assert.equal(server._websocketHandler.name, 'noop')
    assert.equal(server._httpHandler.name, 'defaultHttpHandler')

    let resolve0
    const promise0 = new Promise(_resolve => {
      resolve0 = _resolve
    })
    server.listen(7357, () => {
      resolve0()
    })
    await promise0

    server.on('request', () => {
      didRequest = true
    })

    let resolve1
    const promise1 = new Promise(_resolve => {
      resolve1 = _resolve
    })

    const request = https.request({
      hostname: 'localhost',
      protocol: 'https:',
      port: 7357,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false
    }, resolve1)
    request.end()

    const response = await promise1

    let resolve2
    const promise2 = new Promise(_resolve => {
      resolve2 = _resolve
    })

    const chunks = []
    response.on('data', chunk => {
      chunks.push(chunk)
    })
    response.on('end', () => {
      resolve2(chunks.map(chunk => chunk.toString('utf8')).join(''))
    })

    const responseBodyText = await promise2

    assert.equal(response.statusCode, 200)
    assert.equal(responseBodyText, 'OK')
    assert(didRequest)

    server.close()

    // coverage
    const testHandler = () => {}
    const server2 = new WebSocket.SecureServer(undefined, {
      httpHandler: testHandler,
      cert: fs.readFileSync('./test/localhost-encrypted.crt'),
      key: fs.readFileSync('./test/localhost-encrypted.key'),
      passphrase: 'passphrase'
    })
    assert.equal(server2._websocketHandler.name, 'noop')
    assert.equal(server2._httpHandler, testHandler)

    const server3 = new WebSocket.Server(undefined, {
      cert: fs.readFileSync('./test/localhost-encrypted.crt'),
      key: fs.readFileSync('./test/localhost-encrypted.key'),
      passphrase: 'passphrase'
    })
    assert.equal(server3._websocketHandler.name, 'noop')
    assert.equal(server3._httpHandler.name, 'defaultHttpHandler')

    await sleep(100)
  }).timeout(10000)

  it('WebSocket.Server handles HTTP with an optional httpHandler', async () => {
    let didRequest = false

    const server = new WebSocket.Server({
      httpHandler(request, response) {
        response.writeHead(426, {
          'Content-Type': 'text/plain',
        })
        response.end('Upgrade Required')
      }
    })
    server.listen(7357)

    const http = new Http('http://localhost:7357')
    const response = await http.get('/')

    assert.equal(response.status, 426)
    assert.equal(await response.text(), 'Upgrade Required')
    server.close()

    await sleep(100)
  })

  it('WebSocket.Server handles WSS with secure, key, and cert options', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const server = new WebSocket.Server({
      secure: true,
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })

    server.listen(7357)

    const messages = []

    server.on('connection', (websocket, request, head) => {
      assert.equal(typeof request, 'object')
      assert(Buffer.isBuffer(head))
      websocket.on('message', message => {
        messages.push(message.toString('utf8'))
        websocket.send('pong')
      })

      websocket.on('close', () => {
        server.close()
      })
    })

    const websocket = new WebSocket('wss://127.0.0.1:7357', {
      rejectUnauthorized: false
    })

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send('ping')
    })

    server.on('close', () => {
      resolve()
    })

    await promise
    assert.strictEqual(messages.length, 2)
    assert.strictEqual(messages[0].toString('utf8'), 'ping')
    assert.strictEqual(messages[1].toString('utf8'), 'pong')

    await sleep(100)
  })

  it('WebSocket.SecureServer handles WSS with key, and cert options', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const server = new WebSocket.SecureServer({
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })

    server.listen(7357)

    const messages = []

    server.on('connection', websocket => {
      websocket.on('message', message => {
        messages.push(message.toString('utf8'))
        websocket.send('pong')
      })

      websocket.on('close', () => {
        server.close()
      })
    })

    const websocket = new WebSocket('wss://127.0.0.1:7357', {
      rejectUnauthorized: false
    })

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send('ping')
    })

    server.on('close', () => {
      resolve()
    })

    await promise
    assert.strictEqual(messages.length, 2)
    assert.strictEqual(messages[0].toString('utf8'), 'ping')
    assert.strictEqual(messages[1].toString('utf8'), 'pong')

    // coverage
    const testHandler = () => {}

    const server2 = new WebSocket.SecureServer(testHandler, {
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })
    assert.equal(server2._websocketHandler, testHandler)
    assert.equal(server2._httpHandler.name, 'defaultHttpHandler')

    const server3 = new WebSocket.SecureServer({
      websocketHandler: testHandler,
      cert: fs.readFileSync('./test/localhost.crt'),
      key: fs.readFileSync('./test/localhost.key')
    })
    assert.equal(server3._websocketHandler, testHandler)
    assert.equal(server3._httpHandler.name, 'defaultHttpHandler')

    await sleep(100)
  })

  it('WebSocket.Server bad options', async () => {
    assert.throws(
      () => new WebSocket.Server(1),
      new TypeError('bad options')
    )
  })

  it('WebSocket.SecureServer bad options', async () => {
    assert.throws(
      () => new WebSocket.SecureServer(),
      new TypeError('invalid key and cert options')
    )

    assert.throws(
      () => new WebSocket.SecureServer({}),
      new TypeError('invalid key and cert options')
    )

    assert.throws(
      () => new WebSocket.SecureServer({ key: '' }),
      new TypeError('invalid key and cert options')
    )
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
      assert.strictEqual(websocket.readyState, 3)
      resolve()
    })

    await promise
    server.close()

    await sleep(100)
  }).timeout(10000)

  it('Bad WebSocket', async () => {
    const server = new WebSocket.Server()
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

  it('WebSocket port 80 with autoConnect false', async () => {
    const websocket = new WebSocket('ws://localhost/', { autoConnect: false })
    assert.equal(websocket.url.port, '80')
    assert.strictEqual(websocket.readyState, 3) // not yet connecting
  })

  it('WebSocket port 443 with autoConnect false', async () => {
    const websocket = new WebSocket('wss://localhost/', { autoConnect: false })
    assert.equal(websocket.url.port, '443')
    assert.strictEqual(websocket.readyState, 3) // not yet connecting
  })

  it('WebSocket destroyed before handshake', async () => {
    const websocket = new WebSocket('ws://localhost/')
    assert.strictEqual(websocket.readyState, 0)
    websocket.destroy()
    assert.strictEqual(websocket.readyState, 3)
  }).timeout(1000)

  it('WebSocket reconnects', async () => {
    const server = new WebSocket.Server()
    server.listen(1337)

    const websocket = new WebSocket('ws://localhost:1337/')

    let reconnects = 0
    let socket = websocket._socket
    while (reconnects < 5) {
      let resolve
      const promise = new Promise(_resolve => {
        resolve = _resolve
      })

      websocket.connect()
      assert.notEqual(websocket._socket, socket)

      websocket.on('open', resolve)
      await promise

      socket = websocket._socket
      reconnects += 1
    }

    server.close()
  }).timeout(5000)

  it('Server closes WebSocket immediately (websocket handler in constructor)', async () => {
    const server = new WebSocket.Server((websocket, request, head) => {
      websocket.close()
    })
    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357/')
    assert.strictEqual(websocket.readyState, 0) // CONNECTING

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })
    websocket.on('close', () => {
      server.close()
      resolve()
    })

    let didOpen = false
    websocket.on('open', () => {
      didOpen = true
    })
    await promise
    assert.strictEqual(websocket.readyState, 3)
    assert(didOpen)
  }).timeout(10000)

  it('Server closes WebSocket immediately (websocket handler in connection event)', async () => {
    const server = new WebSocket.Server()

    server.on('connection', (websocket, request, head) => {
      websocket.close()
    })

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357/')
    assert.strictEqual(websocket.readyState, 0) // CONNECTING

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })
    websocket.on('close', () => {
      server.close()
      resolve()
    })

    let didOpen = false
    websocket.on('open', () => {
      didOpen = true
    })
    await promise
    assert.strictEqual(websocket.readyState, 3)
    assert(didOpen)
  }).timeout(10000)

  it('WebSocket.Server and WebSocket text exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      assert.strictEqual(websocket.readyState, 1)
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send('pong')
      })

      websocket.on('close', () => {
        assert.strictEqual(websocket.readyState, 3)
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
    assert.strictEqual(websocket.readyState, 0)

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
      assert.strictEqual(websocket.readyState, 2)
    })

    websocket.on('open', () => {
      assert.strictEqual(websocket.readyState, 1)
      websocket.send('ping')
    })

    let resolve2
    const promise2 = new Promise(_resolve => {
      resolve2 = _resolve
    })

    websocket.on('close', () => {
      assert.strictEqual(websocket.readyState, 3)
      resolve2()
    })

    await promise
    await promise2
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].toString('utf8'), 'ping')
    assert.equal(messages[1].toString('utf8'), 'pong')
    assert.equal(server.connections.length, 0)
    server.close()

    await sleep(100)
  }).timeout(10000)

  xit('Byte-by-byte WebSocket.Server and WebSocket text exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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
    assert.strictEqual(websocket.readyState, 0)

    websocket.on('message', message => {
      console.log('message', message.toString('utf8'))
      messages.push(message)
      websocket.close()
      assert.strictEqual(websocket.readyState, 2)
    })

    websocket.on('open', () => {
      assert.strictEqual(websocket.readyState, 1)
      websocket.send('ping')
      // <Buffer 81 04 70 6f 6e 67>
      // websocket._socket.write(Buffer.from([0x81, 0x04, 0x70, 0x6f, 0x6e, 0x67]))
      // websocket._socket.write(Buffer.from([0x81]))
      // websocket._socket.write(Buffer.from([0x04]))
      // websocket._socket.write(Buffer.from([0x70]))
      // websocket._socket.write(Buffer.from([0x6f]))
      // websocket._socket.write(Buffer.from([0x6e]))
      // websocket._socket.write(Buffer.from([0x67]))
    })

    let resolve2
    const promise2 = new Promise(_resolve => {
      resolve2 = _resolve
    })

    websocket.on('close', () => {
      assert.strictEqual(websocket.readyState, 3)
      resolve2()
    })

    await promise
    await promise2
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].toString('utf8'), 'ping')
    assert.equal(messages[1].toString('utf8'), 'pong')
    server.close()

    await sleep(100)
  }).timeout(10000)

  it('WebSocket.Server and WebSocket buffer exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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

  it('WebSocket.Server and WebSocket ping/pong exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const messages = []

    const pingPongResults = {
      serverGotPing: false,
      serverGotPong: false,
      clientGotPing: false,
      clientGotPong: false,
    }

    const server = new WebSocket.Server(websocket => {
      websocket.on('ping', message => {
        assert.equal(message.toString('utf8'), 'test')
        pingPongResults.serverGotPing = true
        websocket.sendPing('test')
      })

      websocket.on('pong', message => {
        assert.equal(message.toString('utf8'), 'test')
        pingPongResults.serverGotPong = true
      })

      websocket.on('close', () => {
        server.close()
      })
    })

    server.on('close', () => {
      resolve()
    })

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('ping', message => {
      assert.equal(message.toString('utf8'), 'test')
      pingPongResults.clientGotPing = true
    })

    let npongs = 0
    websocket.on('pong', message => {
      npongs += 1
      if (npongs === 1) { // discard initial pong from server
        return
      }
      assert.equal(message.toString('utf8'), 'test')
      pingPongResults.clientGotPong = true
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.sendPing('test')
    })

    await promise
    assert(pingPongResults.clientGotPing)
    assert(pingPongResults.clientGotPong)
    assert(pingPongResults.serverGotPing)
    assert(pingPongResults.serverGotPong)
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('WebSocket.Server and WebSocket 3MB buffer exchange with 1MB maxMessageLength', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      assert.equal(websocket._maxMessageLength, 1024 * 1024)

      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send(Buffer.alloc(3 * 1024 * 1024))
      })

      websocket.on('close', () => {
        server.close()
      })
    }, { maxMessageLength: 1024 * 1024 })

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

    const websocket = new WebSocket('ws://localhost:7357', {
      maxMessageLength: 1024 * 1024
    })
    assert.equal(websocket._maxMessageLength, 1024 * 1024)

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

  it('WebSocket.Server and WebSocket 3MB buffer exchange with 3MB maxMessageLength', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      assert.equal(websocket._maxMessageLength, 3 * 1024 * 1024)

      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send(Buffer.alloc(3 * 1024 * 1024))
      })

      websocket.on('close', () => {
        server.close()
      })
    }, {
      maxMessageLength: 3 * 1024 * 1024,
      socketBufferLength: 3 * 1024 * 1024
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

    const websocket = new WebSocket('ws://localhost:7357', {
      maxMessageLength: 1024 * 1024,
      socketBufferLength: 3 * 1024 * 1024
    })
    assert.equal(websocket._maxMessageLength, 1024 * 1024)

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

  it('WebSocket.Server and WebSocket 3MB buffer exchange with perMessageDeflate', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      assert.strictEqual(websocket.perMessageDeflate, true)
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send(Buffer.alloc(3 * 1024 * 1024))
      })

      websocket.on('close', () => {
        server.close()
      })
    }, { perMessageDeflate: true })

    assert.strictEqual(server.perMessageDeflate, true)

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
      assert.strictEqual(websocket.perMessageDeflate, true)
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

  it('WebSocket.Server and WebSocket with perMessageDeflate zlib stub perMessageDeflate tail', async () => {
    const originalZlibDeflateRawSync = zlib.deflateRawSync
    zlib.deflateRawSync = () => Buffer.from([0x00, 0x00, 0xff, 0xff])

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      assert.strictEqual(websocket.perMessageDeflate, true)
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send(Buffer.from([0x00, 0x00, 0xff, 0xff]))
      })

      websocket.on('close', () => {
        server.close()
      })
    }, { perMessageDeflate: true })

    assert.strictEqual(server.perMessageDeflate, true)

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
      assert.strictEqual(websocket.perMessageDeflate, true)
      websocket.send(Buffer.from([0x00, 0x00, 0xff, 0xff]))
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    server.close()
    zlib.deflateRawSync = originalZlibDeflateRawSync

    await sleep(100)
  }).timeout(5000)

  it('WebSocket.Server and WebSocket zlib.deflateRawSync throws error', async () => {
    const originalZlibDeflateRawSync = zlib.deflateRawSync
    zlib.deflateRawSync = () => {
      throw new Error('deflate')
    }

    const server = new WebSocket.Server({ perMessageDeflate: true })
    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const errors = []
    websocket.on('error', error => {
      errors.push(error)
      resolve()
    })

    websocket.on('open', () => {
      websocket.send('test')
    })

    await promise
    assert.equal(errors.length, 1)
    assert.equal(errors[0].message, 'deflate')
    server.close()

    await sleep(100)
  })

  it('WebSocket.Server and WebSocket 3MB string exchange with perMessageDeflate', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.send('/'.repeat(3 * 1024 * 1024))
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
      websocket.send('/'.repeat(3 * 1024 * 1024))
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

  it('WebSocket.Server and WebSocket 65535 byte buffer exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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

  it('WebSocket.Server and WebSocket uint8Array exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
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

  it('Server WebSocket error: Server WebSocket instances cannot use the connect method', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []
    const errors = []

    const server = new WebSocket.Server(websocket => {
      websocket.on('message', message => {
        assert.equal(server.connections.length, 1)
        messages.push(message)
        websocket.connect()
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
    assert.deepEqual(errors[0], new Error('server WebSocket instances cannot use the connect method'))
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('WebSocket catches errors emitted on underlying socket', async () => {
    const server = new WebSocket.Server(websocket => {
      websocket.on('close', () => {
        server.close()
      })
    })

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const errors = []
    websocket.on('error', error => {
      assert.strictEqual(websocket.readyState, 3)
      errors.push(error)
      websocket.close()
      server.close()
      resolve()
    })

    websocket.on('open', () => {
      websocket._socket.emit('error', new Error('test'))
    })

    await promise

    assert.equal(errors.length, 1)
    assert.deepEqual(errors[0], new Error('test'))

    await sleep(100)
  })

  it('WebSocket.Server WebSocket catches errors emitted on underlying socket', async () => {
    const errors = []

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    const server = new WebSocket.Server(websocket => {
      websocket.on('ping', () => {
        websocket._socket.emit('error', new Error('test2'))
      })

      websocket.on('error', error => {
        errors.push(error)
        websocket.close()
      })

      websocket.on('close', () => {
        server.close()
        resolve()
      })
    })

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('close', () => {
      resolve()
    })

    websocket.on('open', () => {
      websocket.sendPing()
    })

    await promise

    assert.equal(errors.length, 1)
    assert.deepEqual(errors[0], new Error('test2'))

    await sleep(100)
  })

  it('WebSocket error when wrong protocol', async () => {
    assert.throws(
      () => new WebSocket('http://localhost:4507/'),
      new TypeError('URL protocol must be "ws" or "wss"')
    )
  })

  it('The server must close the connection upon receiving a frame that is not masked', async () => {
    let resolve0
    const promise0 = new Promise(_resolve => {
      resolve0 = _resolve
    })

    const server = new WebSocket.Server()
    server.on('connection', websocket => {
      websocket.on('close', () => {
        resolve0()
      })
    })
    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('open', () => {
      websocket._socket.write(encodeWebSocketFrame(
        Buffer.from('willclose'),
        0x1,
        false, // mask
        true, // fin
        false, // perMessageDeflate
      ))
    })

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    websocket.on('error', error => {
      console.error('websocket error', error)
    })

    websocket.on('close', message => {
      assert.equal(message.toString('utf8'), 'unmasked frame')
      resolve()
    })

    await promise
    await promise0
    server.close()
  }).timeout(1000)

  it('The client must close the connection upon receiving a frame that is masked', async () => {
    let resolve0
    const promise0 = new Promise(_resolve => {
      resolve0 = _resolve
    })

    const server = new WebSocket.Server()
    server.on('connection', websocket => {
      websocket._socket.write(encodeWebSocketFrame(
        Buffer.from('willclose'),
        0x1,
        true, // mask
        true, // fin
        false, // perMessageDeflate
      ))

      websocket.on('close', message => {
        assert.equal(message.toString('utf8'), 'masked frame')
        resolve0()
      })
    })
    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    websocket.on('close', () => {
      resolve()
    })

    await promise0
    await promise
    server.close()
  })

})

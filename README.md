# Presidium WebSocket
![presidium](https://rubico.land/assets/presidium-logo-3-w200.jpg)

Source code: [GitHub](https://github.com/richytong/presidium-websocket) |
License: [CFOSS](https://cloutsworld.com/en-us/legal/license/cfoss)

![Node.js CI](https://github.com/richytong/presidium-websocket/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-websocket/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-websocket)
[![npm version](https://img.shields.io/npm/v/presidium-websocket.svg?style=flat)](https://www.npmjs.com/package/presidium-websocket)

WebSocket client and server for Node.js. Implements [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455) and [RFC 7692](https://datatracker.ietf.org/doc/html/rfc7692).

```javascript
const WebSocket = require('presidium-websocket')

const server = new WebSocket.Server(websocket => {
  websocket.on('message', message => {
    console.log('Message from client:', message)
    websocket.send('Hello from server!')
  })
  websocket.on('close', () => {
    console.log('websocket closed')
  })
})

server.listen(1337, () => {
  console.log('WebSocket server listening on port 1337')
})

const websocket = new WebSocket('ws://localhost:1337/')

websocket.on('open', () => {
  websocket.send('Hello from client!')
})
websocket.on('message', message => {
  console.log('Message from server:', message)
})
```

Serve WebSocket Secure (WSS) connections.

```javascript
const WebSocket = require('presidium-websocket')
const fs = require('fs')

const server = new WebSocket.SecureServer({
  key: fs.readFileSync('/path/to/my-key'),
  cert: fs.readFileSync('/path/to/my-cert')
})

server.on('connection', websocket => {
  websocket.on('message', message => {
    console.log('Secure message from client:', message)
    websocket.send('Hello from server!')
  })
  websocket.on('close', () => {
    console.log('websocket closed')
  })
})

server.listen(4443, () => {
  console.log('WebSocket Secure server listening on port 4443')
})

const websocket = new WebSocket('wss://localhost:4443/')

websocket.on('open', () => {
  websocket.send('Hello from client!')
})
websocket.on('message', message => {
  console.log('Message from server:', message)
})
```

Supports [Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692) with `supportPerMessageDeflate` (uses zlib [default options](https://nodejs.org/api/zlib.html#class-options)).

```javascript
const server = new WebSocket.Server({ supportPerMessageDeflate: true })
```

Initiate new connections on the same websocket instance.

```javascript
const websocket = new WebSocket('ws://localhost:1337/')

// reconnect websocket on broken connections
while (true) {
  if (websocket.readyState === 1) {
    // websocket is open
  } else {
    // reconnect
    websocket.connect()
  }
  await sleep(10000)
}
```

## Docs
Please find the full documentation for the Presidium library at [presidium.services](https://presidium.services).

Presidium WebSocket class documentation:
  * [WebSocket](https://presidium.services/docs/WebSocket)
  * [WebSocketServer](https://presidium.services/docs/WebSocketServer)
  * [WebSocketSecureServer](https://presidium.services/docs/WebSocketSecureServer)
  * [ServerWebSocket](https://presidium.services/docs/ServerWebSocket)

## Installation

with [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm i presidium-websocket
```

## Benchmarks
Please find all of the published benchmark output inside the [benchmark-output](https://github.com/richytong/presidium-websocket/tree/master/benchmark-output) folder.

### Running benchmarks on your own system

Run benchmarks for presidium-websocket:
```
./bench-presidium
```

## License
Presidium WebSocket is distributed under the [CFOSS License](https://cloutsworld.com/en-us/legal/license/cfoss).

## Support
 * minimum Node.js version: 16

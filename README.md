# presidium-websocket
**Presidium WebSocket**

![Node.js CI](https://github.com/richytong/presidium-websocket/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-websocket/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-websocket)
[![npm version](https://img.shields.io/npm/v/presidium-websocket.svg?style=flat)](https://www.npmjs.com/package/presidium-websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

WebSocket client and server for [Node.js](https://nodejs.org/en).

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

Supports compression with `perMessageDeflate` (uses zlib [default options](https://nodejs.org/api/zlib.html#class-options)).

```javascript
const server = new WebSocket.Server({ perMessageDeflate: true })
```

Initiate new connections using the same websocket instance.

```javascript
const websocket = new WebSocket('ws://localhost:1337/')

// reconnect websocket on broken connections
while (true) {
  if (websocket.readyState === 1) {
    // websocket is open
  } else { // reconnect
    websocket.connect()
  }
  await sleep(10000)
}
```

## Installation

with [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm i presidium-websocket
```

## Benchmarks
Please find the published benchmark output inside the [benchmark-output](https://github.com/richytong/presidium-websocket/tree/master/benchmark-output) folder. You can run the benchmarks on your own system with the following command:
```
npm run bench
```

## Contributing
Your feedback and contributions are welcome. If you have a suggestion, please raise an issue. Prior to that, please search through the issues first in case your suggestion has been made already. If you decide to work on an issue, please create a pull request.

Pull requests should provide some basic context and link the relevant issue. Here is an [example pull request](https://github.com/richytong/presidium-websocket/pull/1). If you are interested in contributing, the [help wanted](https://github.com/richytong/presidium-websocket/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) tag is a good place to start.

For more information please see [CONTRIBUTING.md](/CONTRIBUTING.md)

## License
Presidium WebSocket is [MIT Licensed](https://github.com/richytong/presidium-websocket/blob/master/LICENSE).

## Support
 * minimum Node.js version: 16

# presidium-websocket
**Presidium WebSocket**

![Node.js CI](https://github.com/richytong/presidium-websocket/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-websocket/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-websocket)
[![npm version](https://img.shields.io/npm/v/presidium-websocket.svg?style=flat)](https://www.npmjs.com/package/presidium-websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

WebSocket client and server for [Node.js](https://nodejs.org/en). Implements [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455).

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

## Installation

with [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm i presidium-websocket
```

## Docs

### WebSocket
Constructs a Presidium WebSocket client.

```coffeescript [specscript]
new WebSocket(url string) -> websocket WebSocket

new WebSocket(url string, options {
  rejectUnauthorized: boolean,
  autoConnect: boolean,
  maxMessageLength: number
}) -> websocket WebSocket
```

Options:
  * `rejectUnauthorized` - if `true`, the client verifies the server's certificate against a list of pre-approved certificate authorities (CAs). An [error](#websocket-error-event) event is emitted if verification fails; `err.code` contains the OpenSSL error code. Defaults to `true`.
  * `autoConnect` - if `true`, establishes the underlying TCP connection automatically upon construction. Defaults to `true`.
  * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.

Events:
  * [open](#websocket-open-event)
  * [message](#websocket-message-event)
  * [ping](#websocket-ping-event)
  * [pong](#websocket-pong-event)
  * [error](#websocket-error-event)
  * [close](#websocket-close-event)

#### websocket `'open'` event
Emitted when the WebSocket protocol handshake is complete.

```coffeescript [specscript]
websocket.on('open', ()=>()) -> ()
```

#### websocket `'message'` event
Emitted upon receipt and successful decoding (and reassembly, if applicable) of an incoming message.

```coffeescript [specscript]
websocket.on('message', (message Buffer)=>()) -> ()
```

#### websocket `'ping'` event
Emitted upon receipt and successful decoding of an incoming "ping" message.

```coffeescript [specscript]
websocket.on('ping', (payload Buffer)=>()) -> ()
```

#### websocket `'pong'` event
Emitted upon receipt and successful decoding of an incoming "pong" message.

```coffeescript [specscript]
websocket.on('pong', (payload Buffer)=>()) -> ()
```

#### websocket `'error'` event
Emitted if any errors occur during construction, in any method calls, or on the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).

```coffeescript [specscript]
websocket.on('error', (error Error)=>()) -> ()
```

#### websocket `'close'` event
Emitted when the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) is destroyed. The `'close'` event can be emitted after a call to the [websocket.close](#websocketclose) method.

```coffeescript [specscript]
websocket.on('close', ()=>()) -> ()
```

#### websocket.connect
Initiates a new connection to the WebSocket server.

```coffeescript [specscript]
websocket.connect() -> ()
```

#### websocket.send
Sends a payload to the WebSocket server.

```coffeescript [specscript]
websocket.send(payload Buffer|string) -> ()
```

#### websocket.sendClose
Sends a close frame to the WebSocket server.

```coffeescript [specscript]
websocket.sendClose() -> ()
websocket.sendClose(payload Buffer|string) -> ()
```

#### websocket.sendPing
Sends a ping frame to the server.

```coffeescript [specscript]
websocket.sendPing() -> ()
websocket.sendPing(payload Buffer|string) -> ()
```

#### websocket.sendPong
Sends a pong frame to the server.

```coffeescript [specscript]
websocket.sendPong() -> ()
websocket.sendPong(payload Buffer|string) -> ()
```

#### websocket.close
Closes the connection to the WebSocket server.

```coffeescript [specscript]
websocket.close() -> ()
websocket.close(payload Buffer|string) -> ()
```

#### websocket.destroy
Destroys the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).

```coffeescript [specscript]
websocket.destroy() -> ()
websocket.destroy(payload Buffer|string) -> ()
```

### WebSocket.Server
Constructs a Presidium WebSocket server.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'
module net 'https://nodejs.org/api/net.html'

websocketHandler (websocket WebSocket)=>()
httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
upgradeHandler (request http.ClientRequest, socket net.Socket, head Buffer)=>()

new WebSocket.Server() -> server WebSocket.Server
new WebSocket.Server(websocketHandler) -> server WebSocket.Server

new WebSocket.Server(websocketHandler, options {
  httpHandler: httpHandler,
  secure: boolean,
  key: string,
  cert: string
}) -> server WebSocket.Server

new WebSocket.Server(options {
  websocketHandler: websocketHandler,
  httpHandler: httpHandler,
  secure: boolean,
  key: string,
  cert: string
}) -> server WebSocket.Server

server.on('connection', websocketHandler) -> ()
server.on('request', httpHandler) -> ()
server.on('upgrade', upgradeHandler) -> ()
server.on('error', (error Error)=>()) -> ()
server.on('close', ()=>()) -> ()

server.on('connection', (websocket WebSocket) => {
  websocket.on('open', ()=>()) -> ()
  websocket.on('message', (message Buffer)=>()) -> ()
  websocket.on('ping', ()=>()) -> ()
  websocket.on('pong', ()=>()) -> ()
  websocket.on('error', (error Error)=>()) -> ()
  websocket.on('close', ()=>()) -> ()
})
```

### WebSocket.SecureServer
Constructs a Presidium WebSocket Secure (WSS) server.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'
module net 'https://nodejs.org/api/net.html'

websocketHandler (websocket WebSocket)=>()
httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
upgradeHandler (request http.ClientRequest, socket net.Socket, head Buffer)=>()

new WebSocket.SecureServer(options {
  key: string,
  cert: string
}) -> server WebSocket.SecureServer

new WebSocket.SecureServer(websocketHandler, options {
  httpHandler: httpHandler,
  key: string,
  cert: string
}) -> server WebSocket.SecureServer

new WebSocket.SecureServer(options {
  websocketHandler: websocketHandler,
  httpHandler: httpHandler,
  key: string,
  cert: string
}) -> server WebSocket.SecureServer

server.on('connection', websocketHandler) -> ()
server.on('request', httpHandler) -> ()
server.on('upgrade', upgradeHandler) -> ()
server.on('error', (error Error)=>()) -> ()
server.on('close', ()=>()) -> ()

server.on('connection', (websocket WebSocket) => {
  websocket.on('open', ()=>()) -> ()
  websocket.on('message', (message Buffer)=>()) -> ()
  websocket.on('ping', (payload Buffer)=>()) -> ()
  websocket.on('pong', (payload Buffer)=>()) -> ()
  websocket.on('error', (error Error)=>()) -> ()
  websocket.on('close', ()=>()) -> ()
})
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

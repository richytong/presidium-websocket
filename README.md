# Presidium WebSocket
![presidium](https://rubico.land/assets/presidium-logo-200.jpg)

![Node.js CI](https://github.com/richytong/presidium-websocket/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium-websocket/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium-websocket)
[![npm version](https://img.shields.io/npm/v/presidium-websocket.svg?style=flat)](https://www.npmjs.com/package/presidium-websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

WebSocket client and server for [Node.js](https://nodejs.org/en). Implements [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455) and [RFC 7692](https://datatracker.ietf.org/doc/html/rfc7692).


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
  maxMessageLength: number,
  socketBufferLength: number,
  offerPerMessageDeflate: boolean
}) -> websocket WebSocket
```

Options:
  * `rejectUnauthorized` - if `true`, the client verifies the server's certificate against a list of pre-approved certificate authorities (CAs). An [error](#websocket-error-event) event is emitted if verification fails; `err.code` contains the OpenSSL error code. Defaults to `true`.
  * `autoConnect` - if `true`, establishes the underlying TCP connection automatically upon construction. Defaults to `true`.
  * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
  * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
  * `offerPerMessageDeflate` - if `true`, offers to the server [Per-Message Compression Extensions](https://datatracker.ietf.org/doc/html/rfc7692#section-4) by including the `Sec-WebSocket-Extensions: permessage-deflate` header in the initial WebSocket handshake. If the server supports compression extensions, all messages exchanged in the WebSocket connection will be compressed with [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `true`.

Events:
  * [open](#websocket-open-event)
  * [message](#websocket-message-event)
  * [ping](#websocket-ping-event)
  * [pong](#websocket-pong-event)
  * [error](#websocket-error-event)
  * [close](#websocket-close-event)

Methods:
  * [websocket.send](#websocketsend)
  * [websocket.sendClose](#websocketsendclose)
  * [websocket.sendPing](#websocketsendping)
  * [websocket.sendPong](#websocketsendpong)
  * [websocket.close](#websocketclose)
  * [websocket.destroy](#websocketdestroy)

Attributes:
  * [websocket.readyState](#websocketreadystate)

#### websocket `'open'` event
Emitted when the WebSocket protocol handshake is complete.

```coffeescript [specscript]
websocket.on('open', ()=>()) -> ()
```

Ensure the WebSocket connection is open before sending messages.

```javascript
const server = new WebSocket.Server()

server.on('connection', websocket => {
  websocket.on('open', () => {
    websocket.send('server-message-1')
    websocket.send('server-message-2')
    websocket.send('server-message-3')
  })
})

server.listen(1337)

const websocket = new WebSocket('ws://localhost:1337/')

websocket.on('open', () => {
  websocket.send('client-message-1')
  websocket.send('client-message-2')
  websocket.send('client-message-3')
})
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
Emitted if an error occurs on the WebSocket instance or on the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).

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

#### websocket.readyState
Indicates the current state of the WebSocket connection.

```coffeescript [specscript]
websocket.readyState -> 0|1|2|3
```

Values:
  * `0` - "CONNECTING" - the socket been created, but the connection is not yet open.
  * `1` - "OPEN" - the connection is ready to send and receive data.
  * `2` - "CLOSING" - the connection is in the process of closing.
  * `3` - "CLOSED" - the connection is closed or couldn't be opened.

### WebSocket.Server
Constructs a Presidium WebSocket server.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'
module net 'https://nodejs.org/api/net.html'

type WebSocketHandler = (websocket WebSocket)=>()
type HTTPHandler = (request http.ClientRequest, response http.ServerResponse)=>()

new WebSocket.Server() -> server WebSocket.Server
new WebSocket.Server(websocketHandler WebSocketHandler) -> server WebSocket.Server

new WebSocket.Server(websocketHandler WebSocketHandler, options {
  httpHandler: HTTPHandler,
  secure: boolean,
  key: string|Array<string>|Buffer|Array<Buffer>|Array<{
    pem: string|Buffer,
    passphrase: string
  }>,
  cert: string|Array<string>|Buffer|Array<Buffer>,
  passphrase: string,
  supportPerMessageDeflate: boolean,
  maxMessageLength: number,
  socketBufferLength: number
}) -> server WebSocket.Server

new WebSocket.Server(options {
  websocketHandler: WebSocketHandler,
  httpHandler: HTTPHandler,
  secure: boolean,
  key: string|Array<string>|Buffer|Array<Buffer>|Array<{
    pem: string|Buffer,
    passphrase: string
  }>,
  cert: string|Array<string>|Buffer|Array<Buffer>,
  passphrase: string,
  supportPerMessageDeflate: boolean,
  maxMessageLength: number,
  socketBufferLength: number
}) -> server WebSocket.Server
```

Options:
  * `httpHandler` - function that processes incoming HTTP requests from clients. Defaults to an HTTP handler that responds with `200 OK`.
  * `secure` - if `true`, starts an HTTPS server instead of an HTTP server. Clients must connect to the server using the `wss` protocol instead of the `ws` protocol. Requires `key` and `cert` options.
  * `key` - private key(s) in PEM format. Encrypted keys will be decrypted using the `passphrase` option. Multiple keys using different algorithms can be provided as an array of unencrypted key strings or buffers, or an array of objects in the form `{ pem: string|Buffer, passphrase: string }`.
  * `cert` - cert chain(s) in PEM format. One cert chain should be provided per private key.
  * `passphrase` - used to decrypt the private key(s).
  * `supportPerMessageDeflate` - if `true`, indicates to WebSocket clients that the server supports [Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692). If an incoming WebSocket connection has requested compression extensions via the `Sec-WebSocket-Extensions: permessage-deflate` header, all messages exchanged in the WebSocket connection will be compressed using [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `false`.
  * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
  * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) for all connections to the server.

Events:
  * [connection](#server-connection-event)
  * [request](#server-request-event)
  * [upgrade](#server-upgrade-event)
  * [close](#server-close-event)

Methods:
  * [server.listen](#serverlisten)
  * [server.close](#serverclose)

Attributes:
  * [server.connections](#serverconnections)

#### server `'connection'` event
Emitted when a new WebSocket connection is made to the server.

```coffeescript [specscript]
server.on('connection', (websocket WebSocket) => {
  websocket.on('open', ()=>()) -> ()
  websocket.on('message', (message Buffer)=>()) -> ()
  websocket.on('ping', (payload Buffer)=>()) -> ()
  websocket.on('pong', (payload Buffer)=>()) -> ()
  websocket.on('error', (error Error)=>()) -> ()
  websocket.on('close', ()=>()) -> ()

  websocket.send(payload Buffer|string) -> ()
  websocket.sendClose(payload Buffer|string) -> ()
  websocket.sendPing(payload Buffer|string) -> ()
  websocket.sendPong(payload Buffer|string) -> ()
  websocket.close() -> ()
  websocket.destroy() -> ()
})
```

See [WebSocket](#websocket).

#### server `'request'` event
Emitted on each HTTP request to the server.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'

type HTTPHandler = (request http.ClientRequest, response http.ServerResponse)=>()

server.on('request', httpHandler HTTPHandler) -> ()
```

#### server `'upgrade'` event
Emitted when a client requests an HTTP upgrade.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'
module net 'https://nodejs.org/api/net.html'

type UpgradeHandler = (request http.ClientRequest, socket net.Socket, head Buffer)=>()

server.on('upgrade', upgradeHandler UpgradeHandler) -> ()
```

#### server `'close'` event
Emitted when the server's [close](#serverclose) method is called.

```coffeescript [specscript]
server.on('close', ()=>()) -> ()
```

#### server.listen
Starts the server listening for connections.

```coffeescript [specscript]
server.listen(port number) -> ()
server.listen(port number, callback ()=>()) -> ()
server.listen(port number, host string, callback ()=>()) -> ()
server.listen(port number, backlog number, callback ()=>()) -> ()
server.listen(port number, host string, backlog number, callback ()=>()) -> ()
```

Arguments:
  * `port` - the network port on which the server is listening.
  * `host` - the ip address of the network device on which the server is running. Defaults to the [0.0.0.0](https://en.wikipedia.org/wiki/0.0.0.0).
  * `backlog` - a number that specifies the maximum length of the queue of pending connections. Defaults to 511.
  * `callback` - a function that is called when the server has started listening.

#### server.close
Stops the server from accepting new connections and closes all current connections.

```coffeescript [specscript]
server.close() -> ()
server.close(callback ()=>()) -> ()
```

#### server.connections
An array of WebSocket client connections to the server.

```coffeescript [specscript]
server.connections -> Array<WebSocket>
```

### WebSocket.SecureServer
Constructs a Presidium WebSocket Secure (WSS) server.

```coffeescript [specscript]
module http 'https://nodejs.org/api/http.html'
module net 'https://nodejs.org/api/net.html'

type WebSocketHandler = (websocket WebSocket)=>()
type HTTPHandler = (request http.ClientRequest, response http.ServerResponse)=>()

new WebSocket.SecureServer(websocketHandler WebSocketHandler, options {
  httpHandler: HTTPHandler,
  key: string|Array<string>|Buffer|Array<Buffer>|Array<{
    pem: string|Buffer,
    passphrase: string
  }>,
  cert: string|Array<string>|Buffer|Array<Buffer>,
  passphrase: string,
  supportPerMessageDeflate: boolean,
  maxMessageLength: number
  socketBufferLength: number
}) -> server WebSocket.SecureServer

new WebSocket.SecureServer(options {
  websocketHandler: WebSocketHandler,
  httpHandler: HTTPHandler,
  key: string|Array<string>|Buffer|Array<Buffer>|Array<{
    pem: string|Buffer,
    passphrase: string
  }>,
  cert: string|Array<string>|Buffer|Array<Buffer>,
  passphrase: string,
  supportPerMessageDeflate: boolean,
  maxMessageLength: number
  socketBufferLength: number
}) -> server WebSocket.SecureServer
```

Options:
  * `httpHandler` - function that processes incoming HTTP requests from clients. Defaults to an HTTP handler that responds with `200 OK`.
  * `key` - private key(s) in PEM format. Encrypted keys will be decrypted using the `passphrase` option. Multiple keys using different algorithms can be provided as an array of unencrypted key strings or buffers, or an array of objects in the form `{ pem: string|Buffer, passphrase: string }`.
  * `cert` - cert chain(s) in PEM format. One cert chain should be provided per private key.
  * `passphrase` - used to decrypt the private key(s).
  * `supportPerMessageDeflate` - if `true`, indicates to WebSocket clients that the server supports [Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692). If an incoming WebSocket connection has requested compression extensions via the `Sec-WebSocket-Extensions: permessage-deflate` header, all messages exchanged in the WebSocket connection will be compressed using [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `false`.
  * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
  * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) for all connections to the server.

Events:
  * [connection](#server-connection-event)
  * [request](#server-request-event)
  * [upgrade](#server-upgrade-event)
  * [close](#server-close-event)

Methods:
  * [server.listen](#serverlisten)
  * [server.close](#serverclose)

## Benchmarks
Stats for 30 individual 30s runs of [bench-presidium](/bench-presidium) and [bench-ws](/bench-ws) with a small (16 byte) buffer:
```
OS 6.15.4-arch2-1
Node.js v22.12.0
presidium-websocket@0.1.2
ws@8.18.3

Presidium Max Throughput: 773.9204074888052
Presidium Min Throughput: 663.717446247961
Presidium Avg Throughput: 740.4098268048717

ws Max Throughput:        734.9618854401924
ws Min Throughput:        699.1601014862653
ws Avg Throughput:        721.359269165629
```

Single run results of [bench-presidium](/bench-presidium) and [bench-ws](/bench-ws) with a large (3MB) buffer:
```
OS 6.15.4-arch2-1
Node.js v22.12.0
presidium-websocket@0.1.2
ws@8.18.3

Time: 30.561878826 seconds
Presidium throughput: 30.706097880478325 messages/s
Presidium messages:   937

Time: 30.536667375 seconds
ws throughput:        32.7349797644342 messages/s
ws messages:          998
```

Please find all of the published benchmark output inside the [benchmark-output](https://github.com/richytong/presidium-websocket/tree/master/benchmark-output) folder.

### Running benchmarks on your own system

Run benchmarks for [ws](https://github.com/websockets/ws):
```
./bench-ws
```

Run benchmarks for presidium-websocket:
```
./bench-presidium
```

## Contributing
Your feedback and contributions are welcome. If you have a suggestion, please raise an issue. Prior to that, please search through the issues first in case your suggestion has been made already. If you decide to work on an issue, please create a pull request.

Pull requests should provide some basic context and link the relevant issue. Here is an [example pull request](https://github.com/richytong/presidium-websocket/pull/5). If you are interested in contributing, the [help wanted](https://github.com/richytong/presidium-websocket/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) tag is a good place to start.

For more information please see [CONTRIBUTING.md](/CONTRIBUTING.md)

## License
Presidium WebSocket is [MIT Licensed](https://github.com/richytong/presidium-websocket/blob/master/LICENSE).

## Support
 * minimum Node.js version: 16

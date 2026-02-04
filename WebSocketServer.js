/**
 * presidium-websocket v1.0.1
 * https://github.com/richytong/presidium-websocket
 * (c) 2025 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const http = require('http')
const https = require('https')
const crypto = require('crypto')
const events = require('events')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const ServerWebSocket = require('./_internal/ServerWebSocket')
const LinkedList = require('./_internal/LinkedList')
const __ = require('./_internal/placeholder')
const curry3 = require('./_internal/curry3')
const append = require('./_internal/append')
const call = require('./_internal/call')
const remove = require('./_internal/remove')
const thunkify1 = require('./_internal/thunkify1')
const thunkify2 = require('./_internal/thunkify2')
const thunkify4 = require('./_internal/thunkify4')
const thunkify5 = require('./_internal/thunkify5')
const functionConcatSync = require('./_internal/functionConcatSync')
const {
  kBuffer,
  kBufferCb
} = require('./_internal/stream_base_commons')
const _onread = require('./_internal/_onread')
const defaultHttpHandler = require('./_internal/defaultHttpHandler')

/**
 * @name WebSocketServer
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 * module net 'https://nodejs.org/api/net.html'
 *
 * websocketHandler (websocket WebSocket)=>undefined
 * httpHandler (request http.ClientRequest, response http.ServerResponse)=>undefined
 * upgradeHandler (request http.ClientRequest, socket net.Socket, head Buffer)=>undefined
 *
 * new WebSocketServer() -> server WebSocketServer
 * new WebSocketServer(websocketHandler) -> server WebSocketServer
 *
 * new WebSocketServer(websocketHandler, options {
 *   httpHandler: httpHandler,
 *   secure: boolean,
 *   key: string,
 *   cert: string,
 *   passphrase: string
 * }) -> server WebSocketServer
 *
 * new WebSocketServer(options {
 *   websocketHandler: websocketHandler,
 *   httpHandler: httpHandler,
 *   secure: boolean,
 *   key: string,
 *   cert: string,
 *   passphrase: string
 * }) -> server WebSocketServer
 * ```
 *
 * Presidium WebSocketServer class.
 *
 * Arguments:
 *   * `websocketHandler` - a handler function that expects an instance of a [`ServerWebSocket`](#ServerWebSocket). Represents the server's WebSocket connection to the client.
 *   * `options`
 *     * `httpHandler` - function that processes incoming HTTP requests from clients. Defaults to an HTTP handler that responds with `200 OK`.
 *     * `secure` - if `true`, starts an HTTPS server instead of an HTTP server. Clients must connect to the server using the `wss` protocol instead of the `ws` protocol. Requires `key` and `cert` options.
 *     * `key` - private key(s) in PEM format. Encrypted keys will be decrypted using the `passphrase` option. Multiple keys using different algorithms can be provided as an array of unencrypted key strings or buffers, or an array of objects in the form `{ pem: string|Buffer, passphrase: string }`.
 *     * `cert` - cert chain(s) in PEM format. One cert chain should be provided per private key.
 *     * `passphrase` - used to decrypt the private key(s).
 *     * `supportPerMessageDeflate` - if `true`, indicates to WebSocket clients that the server supports [Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692). If an incoming WebSocket connection has requested compression extensions via the `Sec-WebSocket-Extensions: permessage-deflate` header, all messages exchanged in the WebSocket connection will be compressed using [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `false`.
 *     * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
 *     * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) for all connections to the server.
 *
 * Return:
 *   * `server` - an instance of the WebSocketServer.
 *
 * ```javascript
 * const server = new WebSocketServer()
 *
 * server.listen(1337, () => {
 *   console.log('WebSocket server listening on port 1337')
 * })
 * ```
 */
class WebSocketServer extends events.EventEmitter {
  constructor(...args) {
    super()

    let options
    if (args.length == 0) {
      options = {}
    } else if (args.length == 1) {
      if (typeof args[0] == 'function') {
        this._websocketHandler = args[0]
        options = {}
      } else if (typeof args[0] == 'object') {
        options = args[0] ?? {}
      } else {
        throw new TypeError('bad options')
      }
    } else {
      this._websocketHandler = args[0]
      options = args[1] ?? {}
    }

    this._httpHandler = options.httpHandler ?? defaultHttpHandler

    if (options.supportPerMessageDeflate) {
      this._supportPerMessageDeflate = true
    }

    this._maxMessageLength = options.maxMessageLength ?? 4 * 1024
    this._socketBufferLength = options.socketBufferLength ?? 100 * 1024

    if (options.secure) {
      this._server = https.createServer({
        key: options.key,
        cert: options.cert,
        passphrase: options.passphrase
      })
    } else {
      this._server = http.createServer()
    }

    this._server.on('request', this._handleRequest.bind(this))
    this._server.on('upgrade', this._handleUpgrade.bind(this))

    this.connections = []

  }

  /**
   * @name Event: connection
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('connection', websocket ServerWebSocket)
   * ```
   *
   * Event Data:
   *   * `websocket` - an instance of a [ServerWebSocket](#ServerWebSocket). Represents the server's WebSocket connection to the client.
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.on('connection', websocket => {
   *   console.log('New WebSocket connection.')
   * })
   * ```
   */

  /**
   * @name Event: request
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * emit('request', request http.ClientRequest, response http.ServerResponse)
   * ```
   *
   * Event Data:
   *   * `request` - an instance of a [Node.js http.ClientRequest](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpclientrequest). Represents a client's HTTP request to the server.
   *   * `response` - an instance of a [Node.js http.ServerResponse](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpserverresponse). Represents the server's HTTP response to the client.
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.on('request', (request, response) => {
   *   console.log('New HTTP request.')
   * })
   * ```
   */

  /**
   * @name Event: upgrade
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   * module net 'https://nodejs.org/api/net.html'
   *
   * emit('upgrade', request http.ClientRequest, socket net.Socket, head Buffer)
   * ```
   *
   * Event Data:
   *   * `request` - an instance of a [Node.js http.ClientRequest](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpclientrequest). Represents a client's HTTP request to the server.
   *   * `socket` - an instance of a [Node.js net.Socket](https://nodejs.org/docs/latest-v24.x/api/net.html#class-netsocket). Represents the server's underlying TCP connection to the client.
   *   * `head` - a [Node.js buffer](https://nodejs.org/api/buffer.html) containing the first packet of the upgraded data stream.
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.on('upgrade', (request, socket, heaad) => {
   *   console.log('Upgrade')
   * })
   * ```
   */

  /**
   * @name Event: close
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('close')
   * ```
   *
   * Event Data:
   *   * (none)
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.on('close', websocket => {
   *   console.log('WebSocket server closed.')
   * })
   * ```
   */

  /**
   * @name _handleRequest
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleRequest(
   *   request http.ClientRequest,
   *   response http.ServerResponse
   * ) -> ()
   * ```
   */
  _handleRequest(request, response) {
    this.emit('request', request)
    this._httpHandler(request, response)
  }

  /**
   * @name _handleUpgrade
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleUpgrade(
   *   request http.ClientRequest,
   *   socket net.Socket,
   *   head Buffer # contains first packet of the upgraded stream
   * ) -> ()
   * ```
   */
  _handleUpgrade(request, socket, head) {
    this._changeBuffer(socket)

    if (
      request.headers['upgrade'] == 'websocket'
      && typeof request.headers['sec-websocket-key'] == 'string'
    ) {
      const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
      const hash = crypto.createHash('sha1')
      hash.update(request.headers['sec-websocket-key'] + guid)
      const acceptKey = hash.digest('base64')

      const clientRequestedPerMessageDeflate =
        request.headers['sec-websocket-extensions']
        ?.includes('permessage-deflate')

      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey}\r\n${clientRequestedPerMessageDeflate && this._supportPerMessageDeflate ? 'Sec-WebSocket-Extensions: permessage-deflate\r\n' : ''}\r\n`
      )

      if (clientRequestedPerMessageDeflate && this._supportPerMessageDeflate) {
        socket._perMessageDeflate = true
      }
      this.emit('upgrade', request, socket, head)

      this._handleUpgradedConnection(socket, request, head)

    } else {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    }
  }

  /**
   * @name _changeBuffer
   *
   * @docs
   * ```coffeescript [specscript]
   * _changeBuffer(socket net.Socket) -> ()
   * ```
   */
  _changeBuffer(socket) {
    const buffer = Buffer.alloc(this._socketBufferLength)
    socket._handle.useUserBuffer(buffer)
    socket[kBuffer] = buffer
    socket[kBufferCb] = _onread.bind(socket)
  }

  /**
   * @name _handleUpgradedConnection
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleUpgradedConnection(
   *   socket net.Socket,
   *   request http.ClientRequest,
   *   head Buffer
   * ) -> ()
   * ```
   */
  _handleUpgradedConnection(socket, request, head) {
    const chunks = new LinkedList()
    const websocket = new ServerWebSocket(socket, {
      maxMessageLength: this._maxMessageLength,
      socketBufferLength: this._socketBufferLength
    })

    this.emit('connection', websocket, request, head)
    if (typeof this._websocketHandler == 'function') {
      this._websocketHandler(websocket, request, head)
    }

    this.connections.push(websocket)
    websocket.once('ping', thunkify5(
      call,
      this._handleOpen,
      this,
      websocket,
      request,
      head
    ))

    websocket.on('close', thunkify2(
      remove,
      this.connections,
      websocket
    ))

    socket.on('data', functionConcatSync(
      curry3(append, chunks, __, 'WebSocketServer'),
      thunkify1(
        process.nextTick,
        thunkify4(call, this._processChunk, this, chunks, websocket)
      )
    ))
  }

  /**
   * @name _handleOpen
   *
   * @docs
   * ```coffeescript [specscript]
   * _handleOpen(websocket ServerWebSocket) -> ()
   * ```
   */
  _handleOpen(websocket) {
    websocket.readyState = 1
    websocket.emit('open')
  }

  /**
   * @name _processChunk
   *
   * @docs
   * ```coffeescript [specscript]
   * server._processChunk(
   *   chunks Array<Buffer>,
   *   websocket ServerWebSocket
   * ) -> ()
   * ```
   */
  async _processChunk(chunks, websocket) {

    while (chunks.length > 0) { // process data frames
      let chunk = chunks.shift()
      let decodeResult = await decodeWebSocketFrame.call(websocket, chunk, websocket._perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = await decodeWebSocketFrame.call(websocket, chunk, websocket._perMessageDeflate)
      }
      if (decodeResult == null) {
        chunks.prepend(chunk)
        return undefined
      }

      const { fin, opcode, payload, remaining, masked } = decodeResult

      // The server must close the connection upon receiving a frame that is not masked
      if (!masked) {
        websocket.sendClose('unmasked frame')
        websocket.destroy()
        break
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this._handleDataFrame(websocket, payload, opcode, fin)
    }

  }

  /**
   * @name _handleDataFrame
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleDataFrame(
   *   websocket ServerWebSocket,
   *   payload Buffer,
   *   opcode number,
   *   fin boolean
   * ) -> ()
   * ```
   */
  _handleDataFrame(websocket, payload, opcode, fin) {
    if (opcode === 0x0) { // continuation frame
      websocket._continuationPayloads.push(payload)
      if (fin) { // last continuation frame
        websocket.emit('message', Buffer.concat(websocket._continuationPayloads))
        websocket._continuationPayloads = []
      }
    } else if (fin) { // unfragmented message

      switch (opcode) {
        case 0x1: // text frame
        case 0x2: // binary frame
          websocket.emit('message', payload)
          break
        case 0x8: // close frame
          if (websocket.sentClose) {
            websocket.destroy(payload)
          } else {
            websocket.sendClose(payload)
            websocket.destroy(payload)
          }
          break
        case 0x9: // ping frame
          websocket.emit('ping', payload)
          websocket.sendPong(payload)
          break
        case 0xA: // pong frame
          websocket.emit('pong', payload)
          break
      }

    } else { // fragmented message, wait for continuation frames
      websocket._continuationPayloads.push(payload)
    }
  }

  /**
   * @name listen
   *
   * @docs
   * ```coffeescript [specscript]
   * server.listen(port number) -> undefined
   * server.listen(port number, callback ()=>()) -> undefined
   * server.listen(port number, host string, callback ()=>()) -> undefined
   * server.listen(port number, backlog number, callback ()=>()) -> undefined
   * server.listen(port number, host string, backlog number, callback ()=>()) -> undefined
   * ```
   *
   * Starts the WebSocket server listening for connections.
   *
   * Arguments:
   *   * `port` - the network port on which the server is listening.
   *   * `host` - the ip address of the network device on which the server is running. Defaults to the [0.0.0.0](https://en.wikipedia.org/wiki/0.0.0.0).
   *   * `backlog` - a number that specifies the maximum length of the queue of pending connections. Defaults to 511.
   *   * `callback` - a function that is called when the server has started listening.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.listen(1337, () => {
   *   console.log('WebSocket server listening on port 1337')
   * })
   * ```
   */
  listen(...args) {
    this._server.listen(...args)
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * server.close() -> undefined
   * server.close(callback function) -> undefined
   * ```
   *
   * Stops the server from accepting new connections and closes all current connections.
   *
   * Arguments:
   *   * `callback` - a function that is called once the server has closed.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const server = new WebSocketServer()
   *
   * server.listen(1337, () => {
   *   console.log('WebSocket server listening on port 1337')
   * })
   * ```
   */
  close() {
    this._server.close()
    this.closed = true
    this.connections.forEach(connection => {
      connection.close()
    })
    this.emit('close')
  }
}

module.exports = WebSocketServer

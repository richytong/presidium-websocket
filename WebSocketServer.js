/**
 * presidium-websocket v0.2.3
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
const unhandledErrorListener = require('./_internal/unhandledErrorListener')
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

/**
 * @name WebSocketServer
 *
 * @docs
 * Presidium WebSocket server.
 *
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 * module net 'https://nodejs.org/api/net.html'
 *
 * websocketHandler (websocket WebSocket)=>()
 * httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
 * upgradeHandler (request http.ClientRequest, socket net.Socket, head Buffer)=>()
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
 *
 * server.on('connection', websocketHandler) -> ()
 * server.on('request', httpHandler) -> ()
 * server.on('upgrade', upgradeHandler) -> ()
 * server.on('error', (error Error)=>()) -> ()
 * server.on('close', ()=>()) -> ()
 *
 * server.on('connection', (websocket WebSocket) => {
 *   websocket.on('open', ()=>()) -> ()
 *   websocket.on('message', (message Buffer)=>()) -> ()
 *   websocket.on('ping', ()=>()) -> ()
 *   websocket.on('pong', ()=>()) -> ()
 *   websocket.on('error', (error Error)=>()) -> ()
 *   websocket.on('close', ()=>()) -> ()
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

    this.on('error', unhandledErrorListener.bind(this))

  }

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
  _processChunk(chunks, websocket) {

    while (chunks.length > 0) { // process data frames
      let chunk = chunks.shift()
      let decodeResult = decodeWebSocketFrame.call(this, chunk, websocket._perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketFrame.call(this, chunk, websocket._perMessageDeflate)
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
   * server.listen(port number, callback? function) -> ()
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
   * server.close() -> ()
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

/**
 * @name noop
 *
 * @docs
 * Function that doesn't do anything
 *
 * ```coffeescript [specscript]
 * noop() -> ()
 * ```
 */
function noop() {
}

/**
 * @name defaultHttpHandler
 *
 * @docs
 * Default HTTP handler. Responds with `200 OK`.
 *
 * ```coffeescript [specscript]
 * defaultHttpHandler(request http.ClientRequest, response http.ServerResponse) -> ()
 * ```
 */
function defaultHttpHandler(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/plain',
  })
  response.end('OK')
}

module.exports = WebSocketServer

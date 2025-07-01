const http = require('http')
const https = require('https')
const crypto = require('crypto')
const events = require('events')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const ServerWebSocket = require('./_internal/ServerWebSocket')
const sleep = require('./_internal/sleep')
const unhandledErrorListener = require('./_internal/unhandledErrorListener')
const LinkedList = require('./_internal/LinkedList')
const ProcessChunks = require('./_internal/ProcessChunks')
const __ = require('./_internal/placeholder')
const curry2 = require('./_internal/curry2')
const append = require('./_internal/append')

/**
 * @name WebSocketServer
 *
 * @docs
 * Presidium WebSocket server.
 *
 * ```coffeescript [specscript]
 * websocketHandler (websocket WebSocket)=>()
 * httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
 *
 * new WebSocketServer(websocketHandler) -> server WebSocket.Server
 *
 * new WebSocketServer(websocketHandler, options {
 *   httpHandler: httpHandler,
 *   ssl: boolean,
 *   key: string,
 *   cert: string
 * }) -> server WebSocket.Server
 *
 * new WebSocketServer(options {
 *   websocketHandler: websocketHandler,
 *   httpHandler: httpHandler,
 *   ssl: boolean,
 *   key: string,
 *   cert: string
 * }) -> server WebSocket.Server
 * ```
 */
class WebSocketServer extends events.EventEmitter {
  constructor(websocketHandler, options = {}) {
    super()

    if (websocketHandler == null) {
      this._websocketHandler = noop
    } else if (typeof websocketHandler == 'object') {
      options = websocketHandler
      this._websocketHandler = options.websocketHandler ?? noop
    } else if (typeof websocketHandler == 'function') {
      this._websocketHandler = websocketHandler
    } else {
      this._websocketHandler = options.websocketHandler ?? noop
    }

    this._httpHandler = options.httpHandler ?? defaultHttpHandler

    if (options.ssl) {
      this._server = https.createServer({
        key: options.key,
        cert: options.cert
      }, (request, response) => {
        this.emit('request', request)
        this._httpHandler(request, response)
      })
    } else {
      this._server = http.createServer((request, response) => {
        this.emit('request', request)
        this._httpHandler(request, response)
      })
    }

    this._server.on('upgrade', (request, socket, head) => {
      this.emit('upgrade', request, socket, head)
      this._handleUpgrade(request, socket, head)
    })

    this.clients = new Set()

    this.on('error', unhandledErrorListener.bind(this))
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
    if (
      request.headers['upgrade'] == 'websocket'
      && typeof request.headers['sec-websocket-key'] == 'string'
    ) {
      const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
      const hash = crypto.createHash('sha1')
      hash.update(request.headers['sec-websocket-key'] + guid)
      const acceptKey = hash.digest('base64')

      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`
      ]

      socket.write(headers.join('\r\n') + '\r\n\r\n')

      this._handleDataFrames(socket)

    } else {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    }
  }

  /**
   * @name _handleDataFrames
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleDataFrames(socket net.Socket) -> ()
   * ```
   */
  _handleDataFrames(socket) {
    // const chunks = []
    const chunks = new LinkedList()

    socket.on('data', curry2(append, chunks, __))

    const websocket = new ServerWebSocket(socket)

    this._websocketHandler(websocket)
    this.clients.add(websocket)

    websocket.on('close', () => {
      this.clients.delete(websocket)
    })

    chunks.continuationPayloads = []

    setImmediate(ProcessChunks(chunks, websocket).bind(this))

  }

  /**
   * @name close
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
    this.clients.forEach(client => {
      client.sendClose()
      client.close()
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

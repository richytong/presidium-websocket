/**
 * presidium-websocket v0.0.9
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
const sleep = require('./_internal/sleep')
const unhandledErrorListener = require('./_internal/unhandledErrorListener')

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

    if (options.secure) {
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

      this._handleDataFrames(socket, request, head)

    } else {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    }
  }

  /**
   * @name _handleDataFrames
   *
   * @docs
   * ```coffeescript [specscript]
   * server._handleDataFrames(
   *   socket net.Socket,
   *   request http.ClientRequest,
   *   head Buffer
   * ) -> ()
   * ```
   */
  _handleDataFrames(socket, request, head) {
    let buffer = Buffer.from([])

    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk])
    })

    const websocket = new ServerWebSocket(socket)

    this.emit('connection', websocket, request, head)
    this._websocketHandler(websocket, request, head)
    this.clients.add(websocket)

    websocket.on('close', () => {
      this.clients.delete(websocket)
    })

    let continuationPayloads = []

    setImmediate(async () => {
      while (!this.closed && !websocket.closed) {

        if (buffer.length == 0) {
          await sleep(0)
          continue
        }

        const decodeResult = decodeWebSocketFrame(buffer)
        if (decodeResult == null) {
          await sleep(0)
          continue
        }

        const { fin, opcode, payload, remaining, masked } = decodeResult

        // The server must close the connection upon receiving a frame that is not masked
        if (!masked) {
          websocket.sendClose()
          // websocket.close()
          break
        }

        buffer = remaining

        if (opcode === 0x0) { // continuation frame
          continuationPayloads.push(payload)
          if (fin) { // last continuation frame
            websocket.emit('message', Buffer.concat(continuationPayloads))
            continuationPayloads = []
          }
        } else if (fin) { // unfragmented message

          switch (opcode) {
            case 0x0: // continuation frame
              continuationPayloads.push(payload)
              websocket.emit('message', Buffer.concat(continuationPayloads))
              continuationPayloads = []
              break
            case 0x1: // text frame
            case 0x2: // binary frame
              websocket.emit('message', payload)
              break
            case 0x3: // non-control frame
            case 0x4: // non-control frame
            case 0x5: // non-control frame
            case 0x6: // non-control frame
            case 0x7: // non-control frame
              break
            case 0x8: // close frame
              if (websocket.sentClose) {
                websocket.destroy()
              } else {
                websocket.sendClose()
                websocket.destroy()
              }
              break
            case 0x9: // ping frame
              websocket.emit('ping', payload)
              websocket.sendPong(payload)
              break
            case 0xA: // pong frame
              websocket.emit('pong', payload)
              break
            case 0xB: // control frame
            case 0xC: // control frame
            case 0xD: // control frame
            case 0xE: // control frame
            case 0xF: // control frame
              break
          }

        } else { // fragmented message, wait for continuation frames
          continuationPayloads.push(payload)
        }

        await sleep(0)
      }

    })

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

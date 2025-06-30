const http = require('http')
const crypto = require('crypto')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const ServerWebSocket = require('./_internal/ServerWebSocket')
const Byte = require('./_internal/Byte')
const sleep = require('./_internal/sleep')

/**
 * @name WebSocketServer
 *
 * @docs
 * Presidium WebSocket server.
 *
 * ```coffeescript [specscript]
 * new WebSocketServer(handler (websocket WebSocket)=>()) -> server WebSocket.Server
 *
 * new WebSocketServer(
 *   handler (websocket WebSocket)=>(),
 *   options {
 *     httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
 *   }
 * ) -> server WebSocket.Server
 * ```
 */
class WebSocketServer {
  constructor(handler, options = {}) {
    this._handler = handler
    this._server = http.createServer(options.httpHandler ?? defaultHttpHandler)
    this._server.on('upgrade', this._handleUpgrade.bind(this))
    this.clients = new Set()
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

      console.log('WebSocket connection established!')

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
    const chunks = []

    socket.on('data', chunk => {
      chunks.push(chunk)
    })

    const websocket = new ServerWebSocket(socket)

    this._handler(websocket)
    this.clients.add(websocket)

    websocket.on('close', () => {
      this.clients.delete(websocket)
    })

    setImmediate(async () => {
      while (!this.closed && !socket.destroyed) {

        if (chunks.length == 0) {
          await sleep(0)
          continue
        }

        let chunk = chunks.shift()
        let decodeResult = decodeWebSocketFrame(chunk)
        while (decodeResult == null && chunks.length > 0) {
          chunk = Buffer.concat([chunk, chunks.shift()])
          decodeResult = decodeWebSocketFrame(chunk)
        }
        if (decodeResult == null) {
          chunks.unshift(chunk)
          await sleep(0)
          continue
        }

        const { fin, opcode, payload, remaining, masked } = decodeResult

        if (!masked) {
          websocket.sendClose()
        }

        if (remaining.length > 0) {
          chunks.unshift(remaining)
        }

        switch (opcode) {
          case 0x0: // continuation frame
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
            websocket.sendClose()
            websocket.close()
            break
          case 0x9: // ping frame
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

        await sleep(0)
      }
    })

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
    this.closed = true
    this.clients.forEach(client => client.close())
  }
}

/**
 * @name noop
 *
 * @docs
 * Does not do anything.
 *
 * ```coffeescript [specscript]
 * noop() -> ()
 * ```
 */
function noop() {}

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

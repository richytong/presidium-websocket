const http = require('http')
const crypto = require('crypto')
const events = require('events')
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
class WebSocketServer extends events.EventEmitter {
  constructor(handler, options = {}) {
    super()

    this._handler = handler
    this._httpHandler = options.httpHandler ?? defaultHttpHandler
    this._server = http.createServer((request, response) => {
      this.emit('request', request)
      this._httpHandler(request, response)
    })
    this._server.on('upgrade', (request, socket, head) => {
      this.emit('upgrade', request, socket, head)
      this._handleUpgrade(request, socket, head)
    })
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

    let continuationPayloads = []

    setImmediate(async () => {
      while (!this.closed && !websocket.closed) {

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

        // The server must close the connection upon receiving a frame that is not masked
        if (!masked) {
          websocket.sendClose()
          // websocket.close()
          break
        }

        if (remaining.length > 0) {
          chunks.unshift(remaining)
        }

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

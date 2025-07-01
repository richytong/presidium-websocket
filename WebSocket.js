const net = require('net')
const events = require('events')
const crypto = require('crypto')
const sleep = require('./_internal/sleep')
const encodeWebSocketFrame = require('./_internal/encodeWebSocketFrame')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const decodeWebSocketHandshakeResponse = require('./_internal/decodeWebSocketHandshakeResponse')

const MESSAGE_MAX_LENGTH_BYTES = 1000000

/**
 * @name WebSocket
 *
 * @docs
 * Creates a Presidium WebSocket client.
 *
 * ```coffeescript [specscript]
 * new WebSocket(url string) -> websocket WebSocket
 * ```
 *
 * ```javascript
 * const myWebsocket = new WebSocket('wss://echo.websocket.org/')
 *
 * myWebsocket.addEventListener('open', function (event) {
 *   myWebsocket.send('Hello Server!')
 * })
 *
 * myWebsocket.addEventListener('message', function (event) {
 *   console.log('Message from server:', event.data)
 * })
 * ```
 */
class WebSocket extends events.EventEmitter {
  constructor(url) {
    super()

    const { port, hostname, protocol, pathname } = new URL(url)

    if (protocol != 'ws:' && protocol != 'wss:') {
      throw new Error('URL protocol must be "ws" or "wss"')
    }

    this._socket = net.createConnection(port, hostname, async () => {

      const key = crypto.randomBytes(16).toString('base64')

      const headers = [
        `GET ${pathname} HTTP/1.1`,
        `Host: ${hostname}:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13'
      ]

      this._socket.write(headers.join('\r\n') + '\r\n\r\n')
    })

    this._handleDataFrames()

    const errorListener = error => {
      const errorListenerCount = this.listenerCount('error')
      const errorListeners = this.listeners('error')
      if (errorListenerCount == 1 && errorListeners[0] == errorListener) {
        console.error(error)
        process.exit(1)
      }
    }
    this.on('error', errorListener)
  }

  /**
   * @name _handleDataFrames
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._handleDataFrames() -> ()
   * ```
   */
  _handleDataFrames() {

    const chunks = []

    this._socket.on('data', chunk => {
      chunks.push(chunk)
    })

    setImmediate(async () => {
      while (!this.closed) { // handle handshake response
        if (chunks.length == 0) {
          await sleep(0)
          continue
        }

        let chunk = chunks.shift()
        let decodeResult = decodeWebSocketHandshakeResponse(chunk)
        while (decodeResult == null && chunks.length > 0) {
          chunk = Buffer.concat([chunk, chunks.shift()])
          decodeResult = decodeWebSocketHandshakeResponse(chunk)
        }
        if (decodeResult == null) {
          chunks.unshift(chunk)
          await sleep(0)
          continue
        }

        const { handshakeSucceeded, message, remaining } = decodeResult

        if (!handshakeSucceeded) {
          this.emit('error', new Error(message))
        }

        if (remaining.length > 0) {
          chunks.unshift(remaining)
        }

        this.emit('open')
        await sleep(0)
        break
      }

      let continuationPayloads = []

      while (!this.closed) { // handle data frames

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

        // The client must close the connection upon receiving a frame that is masked
        if (masked) {
          this.close()
          break
        }

        if (remaining.length > 0) {
          chunks.unshift(remaining)
        }

        if (opcode === 0x0) { // continuation frame
          continuationPayloads.push(payload)
          if (fin) { // last continuation frame
            this.emit('message', Buffer.concat(continuationPayloads))
            continuationPayloads = []
          }
        } else if (fin) { // unfragmented message

          switch (opcode) {
            case 0x0: // continuation frame
              continuationPayloads.push(payload)
              this.emit('message', Buffer.concat(continuationPayloads))
              continuationPayloads = []
              break
            case 0x1: // text frame
            case 0x2: // binary frame
              this.emit('message', payload)
              break
            case 0x3: // non-control frame
            case 0x4: // non-control frame
            case 0x5: // non-control frame
            case 0x6: // non-control frame
            case 0x7: // non-control frame
              break
            case 0x8: // close frame
              if (this.sentClose) {
                this.destroy()
              } else {
                this.sendClose()
                this.destroy()
              }
              break
            case 0x9: // ping frame
              this.sendPong(payload)
              break
            case 0xA: // pong frame
              this.emit('pong', payload)
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
   * @name send
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.send(payload Buffer|string) -> ()
   * ```
   */
  send(payload) {
    let buffer = null
    let opcode = null

    if (Buffer.isBuffer(payload)) {
      buffer = payload
      opcode = 0x2
    } else if (ArrayBuffer.isView(buffer)) {
      buffer = Buffer.from(payload.buffer)
      opcode = 0x2
    } else if (typeof payload == 'string') {
      buffer = Buffer.from(payload, 'utf8')
      opcode = 0x1
    } else {
      this.emit('error', new TypeError('send can only process binary or text frames'))
      return undefined
    }

    if (buffer.length < MESSAGE_MAX_LENGTH_BYTES) { // unfragmented
      this._socket.write(encodeWebSocketFrame(buffer, opcode, true))
    } else { // fragmented
      let index = 0
      let fragment = buffer.slice(0, MESSAGE_MAX_LENGTH_BYTES)
      this._socket.write(encodeWebSocketFrame(fragment, opcode, true, false))

      // continuation frames
      index += MESSAGE_MAX_LENGTH_BYTES

      while (index < payload.length) {
        const fin = index + MESSAGE_MAX_LENGTH_BYTES >= payload.length
        fragment = payload.slice(index, index + MESSAGE_MAX_LENGTH_BYTES)

        this._socket.write(encodeWebSocketFrame(fragment, 0x0, true, fin))

        index += MESSAGE_MAX_LENGTH_BYTES
      }
    }

    return undefined
  }

  /**
   * @name sendClose
   *
   * @docs
   * Sends close frame to client
   *
   * ```coffeescript [specscript]
   * websocket.sendClose(payload Buffer|string) -> ()
   * ```
   */
  sendClose(payload = Buffer.from([])) {
    this._socket.write(encodeWebSocketFrame(payload, 0x8, true)) // close frame
    this.sentClose = true
  }

  /**
   * @name sendPing
   *
   * @docs
   * Sends "ping" to client
   *
   * ```coffeescript [specscript]
   * websocket.sendPing(payload Buffer|string) -> ()
   * ```
   */
  sendPing(payload = Buffer.from([])) {
    this._socket.write(encodeWebSocketFrame(payload, 0x9, true)) // ping frame
  }

  /**
   * @name sendPong
   *
   * @docs
   * Sends "pong" back to client
   *
   * ```coffeescript [specscript]
   * websocket.sendPong(payload Buffer|string) -> ()
   * ```
   */
  sendPong(payload = Buffer.from([])) {
    this._socket.write(encodeWebSocketFrame(payload, 0xA, true)) // pong frame
  }

  /**
   * @name close
   *
   * @docs
   * Closes the websocket
   *
   * ```coffeescript [specscript]
   * websocket.close(payload Buffer|string) -> ()
   * ```
   */
  close(payload = Buffer.from([])) {
    this.sendClose(payload)
  }

  /**
   * @name destroy
   *
   * @docs
   * Closes the websocket
   *
   * ```coffeescript [specscript]
   * websocket.destroy() -> ()
   * ```
   */
  destroy() {
    this._socket.destroy()
    this.closed = true
    this.emit('close')
  }
}

module.exports = WebSocket

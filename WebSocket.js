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
          throw new Error(message)
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
    if (payload == null) {
      // noop
    } else if (payload.length < MESSAGE_MAX_LENGTH_BYTES) { // unfragmented
      if (Buffer.isBuffer(payload)) {
        this._socket.write(encodeWebSocketFrame(payload, 0x2, true)) // binary frame
      } else if (ArrayBuffer.isView(payload)) {
        const buffer = Buffer.from(payload.buffer)
        this._socket.write(encodeWebSocketFrame(buffer, 0x2, true)) // binary frame
      } else if (typeof payload == 'string') {
        const buffer = Buffer.from(payload, 'utf8')
        this._socket.write(encodeWebSocketFrame(buffer, 0x1, true)) // text frame
      } else {
        throw new TypeError('send can only process binary or text frames')
      }
    } else { // fragmented
      let index = 0
      let fragment = payload.slice(0, MESSAGE_MAX_LENGTH_BYTES)

      if (Buffer.isBuffer(fragment)) {
        // binary first frame
        this._socket.write(encodeWebSocketFrame(fragment, 0x2, true, false))
      } else if (ArrayBuffer.isView(fragment)) {
        // binary first frame
        const buffer = Buffer.from(fragment.buffer)
        this._socket.write(encodeWebSocketFrame(fragment, 0x2, true, false))
      } else if (typeof fragment == 'string') {
        // text first frame
        const buffer = Buffer.from(fragment, 'utf8')
        this._socket.write(encodeWebSocketFrame(fragment, 0x1, true, false))
      } else {
        throw new TypeError('send can only process binary or text frames')
      }

      // continuation frames
      index += MESSAGE_MAX_LENGTH_BYTES

      while (index < payload.length) {
        const fin = index + MESSAGE_MAX_LENGTH_BYTES >= payload.length
        fragment = payload.slice(index, index + MESSAGE_MAX_LENGTH_BYTES)

        if (Buffer.isBuffer(fragment)) {
          // binary continuation frame
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, true, fin))
        } else if (ArrayBuffer.isView(fragment)) {
          // binary continuation frame
          const buffer = Buffer.from(fragment.buffer)
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, true, fin))
        } else if (typeof fragment == 'string') {
          // text continuation frame
          const buffer = Buffer.from(fragment, 'utf8')
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, true, fin))
        } else {
          throw new TypeError('send can only process binary or text frames')
        }

        index += MESSAGE_MAX_LENGTH_BYTES
      }
    }
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

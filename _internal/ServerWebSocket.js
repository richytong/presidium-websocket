const events = require('events')
const zlib = require('zlib')
const encodeWebSocketFrame = require('./encodeWebSocketFrame')

/**
 * @name ServerWebsocket
 *
 * @docs
 * ```coffeescript [specscript]
 * new ServerWebsocket(socket net.Socket, options {
 *   maxMessageLength: number
 * }) -> websocket ServerWebsocket
 * ```
 */
class ServerWebsocket extends events.EventEmitter {
  constructor(socket, options) {
    super()
    this._socket = socket
    this._perMessageDeflate = socket._perMessageDeflate

    this.on('error', () => {
      this.destroy()
    })

    this._socket.on('error', error => {
      this.emit('error', error)
    })

    this._maxMessageLength = options.maxMessageLength
    this._socketBufferLength = options.socketBufferLength

    this._continuationPayloads = []

    this.readyState = 0 // CONNECTING
  }

  /**
   * @name connect
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.connect() -> ()
   * ```
   */
  connect() {
    this.emit('error', new Error('server WebSocket instances cannot use the connect method'))
  }

  /**
   * @name send
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.send(payload Buffer|string) -> ()
   * ```
   */
  async send(payload) {
    let buffer = null
    let opcode = null

    if (Buffer.isBuffer(payload)) {
      buffer = payload
      opcode = 0x2
    } else if (ArrayBuffer.isView(payload)) {
      buffer = Buffer.from(payload.buffer)
      opcode = 0x2
    } else if (typeof payload == 'string') {
      buffer = Buffer.from(payload, 'utf8')
      opcode = 0x1
    } else {
      this.emit('error', new TypeError('send can only process binary or text frames'))
      return undefined
    }

    let compressed = false

    if (this._perMessageDeflate && buffer.length > 0) {
      try {
        const compressedPayload = zlib.deflateRawSync(buffer)

        if (
          compressedPayload.length >= 4 &&
          compressedPayload.slice(-4).equals(Buffer.from([0x00, 0x00, 0xff, 0xff]))
        ) {
          buffer = compressedPayload.slice(0, -4)
        } else {
          buffer = compressedPayload
        }
        compressed = true

      } catch (error) {
        this.emit('error', error)
        return undefined
      }
    }

    if (buffer.length <= this._maxMessageLength) { // unfragmented
      this._socket.write(encodeWebSocketFrame.call(
        this,
        buffer,
        opcode,
        false,
        true,
        compressed
      ))
    } else { // fragmented

      let index = 0
      let fragment = buffer.slice(0, this._maxMessageLength)

      this._socket.write(encodeWebSocketFrame.call(
        this,
        fragment,
        opcode,
        false,
        false,
        compressed
      ))

      // continuation frames
      index += this._maxMessageLength

      while (index < payload.length) {
        const fin = index + this._maxMessageLength >= payload.length
        fragment = buffer.slice(index, index + this._maxMessageLength)

        this._socket.write(encodeWebSocketFrame.call(
          this,
          fragment,
          0x0,
          false,
          fin,
          compressed
        ))

        index += this._maxMessageLength
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
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0x8)) // close frame
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
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0x9)) // ping frame
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
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0xA)) // pong frame
  }

  /**
   * @name close
   *
   * @docs
   * Closes the websocket
   *
   * ```coffeescript [specscript]
   * websocket.close() -> ()
   * ```
   */
  close(payload = Buffer.from([])) {
    this.readyState = 2 // CLOSING
    this.sendClose(payload)
  }

  /**
   * @name destroy
   *
   * @docs
   * Closes the websocket
   *
   * ```coffeescript [specscript]
   * websocket.destroy(payload Buffer|string) -> ()
   * ```
   */
  destroy(payload) {
    this._socket.destroy()
    this.closed = true
    this.readyState = 3 // CLOSED
    this.emit('close', payload)
  }
}

module.exports = ServerWebsocket

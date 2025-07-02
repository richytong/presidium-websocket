const events = require('events')
const encodeWebSocketFrame = require('./encodeWebSocketFrame')
const unhandledErrorListener = require('./unhandledErrorListener')

const MESSAGE_MAX_LENGTH_BYTES = 1024 * 1024

/**
 * @name ServerWebsocket
 *
 * @docs
 * ```coffeescript [specscript]
 * new ServerWebsocket(socket net.Socket) -> websocket ServerWebsocket
 * ```
 */
class ServerWebsocket extends events.EventEmitter {
  constructor(socket) {
    super()
    this._socket = socket
    this.perMessageDeflate = socket._perMessageDeflate

    this.on('error', unhandledErrorListener.bind(this))

    this._socket.on('error', error => {
      this.emit('error', error)
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

    if (buffer.length < MESSAGE_MAX_LENGTH_BYTES) { // unfragmented
      this._socket.write(encodeWebSocketFrame.call(
        this,
        buffer,
        opcode,
        false,
        true,
        this.perMessageDeflate
      ))
    } else { // fragmented
      let index = 0
      let fragment = buffer.slice(0, MESSAGE_MAX_LENGTH_BYTES)
      this._socket.write(encodeWebSocketFrame.call(
        this,
        fragment,
        opcode,
        false,
        false,
        this.perMessageDeflate
      ))

      // continuation frames
      index += MESSAGE_MAX_LENGTH_BYTES

      while (index < payload.length) {
        const fin = index + MESSAGE_MAX_LENGTH_BYTES >= payload.length
        fragment = payload.slice(index, index + MESSAGE_MAX_LENGTH_BYTES)

        this._socket.write(encodeWebSocketFrame.call(
          this,
          fragment,
          0x0,
          false,
          fin,
          this.perMessageDeflate
        ))

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

module.exports = ServerWebsocket

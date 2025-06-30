const events = require('events')
const encodeWebSocketFrame = require('./encodeWebSocketFrame')

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
  }

  send(payload) {
    if (payload == null) {
      // noop
    } else if (Buffer.isBuffer(payload)) {
      this._socket.write(encodeWebSocketFrame(payload, 0x2)) // binary frame
    } else if (ArrayBuffer.isView(payload)) {
      const buffer = Buffer.from(payload.buffer)
      this._socket.write(encodeWebSocketFrame(payload, 0x2)) // binary frame
    } else if (typeof payload == 'string') {
      const buffer = Buffer.from(payload, 'utf8')
      this._socket.write(encodeWebSocketFrame(payload, 0x2)) // text frame
    }
    // TODO continuation

  }

  /**
   * @name sendClose
   *
   * @docs
   * Sends "pong" back to client
   *
   * ```coffeescript [specscript]
   * websocket.sendClose(payload Buffer) -> ()
   * ```
   */
  sendClose(payload) {
    this._socket.write(encodeWebSocketFrame(payload, 0x8)) // close frame
  }

  /**
   * @name sendPing
   *
   * @docs
   * Sends "ping" to client
   *
   * ```coffeescript [specscript]
   * websocket.sendPing(payload Buffer) -> ()
   * ```
   */
  sendPing() {
    this._socket.write(encodeWebSocketFrame(Buffer.from(''), 0x9)) // ping frame
  }

  /**
   * @name sendPong
   *
   * @docs
   * Sends "pong" back to client
   *
   * ```coffeescript [specscript]
   * websocket.sendPong(payload Buffer) -> ()
   * ```
   */
  sendPong(payload) {
    this._socket.write(encodeWebSocketFrame(payload, 0xA)) // pong frame
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
  close() {
    this.closed = true
    this._socket.destroy()
    this.emit('close')
  }
}

module.exports = ServerWebsocket

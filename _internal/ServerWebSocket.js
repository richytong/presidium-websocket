const events = require('events')
const encodeWebSocketFrame = require('./encodeWebSocketFrame')

const MESSAGE_MAX_LENGTH_BYTES = 1000000

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
        this._socket.write(encodeWebSocketFrame(payload, 0x2)) // binary frame
      } else if (ArrayBuffer.isView(payload)) {
        const buffer = Buffer.from(payload.buffer)
        this._socket.write(encodeWebSocketFrame(buffer, 0x2)) // binary frame
      } else if (typeof payload == 'string') {
        const buffer = Buffer.from(payload, 'utf8')
        this._socket.write(encodeWebSocketFrame(buffer, 0x1)) // text frame
      } else {
        this.emit('error', new TypeError('send can only process binary or text frames'))
      }
    } else { // fragmented
      let index = 0
      let fragment = payload.slice(0, MESSAGE_MAX_LENGTH_BYTES)

      if (Buffer.isBuffer(fragment)) {
        // binary first frame
        this._socket.write(encodeWebSocketFrame(fragment, 0x2, false, false))
      } else if (ArrayBuffer.isView(fragment)) {
        // binary first frame
        const buffer = Buffer.from(fragment.buffer)
        this._socket.write(encodeWebSocketFrame(fragment, 0x2, false, false))
      } else if (typeof fragment == 'string') {
        // text first frame
        const buffer = Buffer.from(fragment, 'utf8')
        this._socket.write(encodeWebSocketFrame(fragment, 0x1, false, false))
      } else {
        this.emit('error', new TypeError('send can only process binary or text frames'))
      }

      // continuation frames
      index += MESSAGE_MAX_LENGTH_BYTES

      while (index < payload.length) {
        const fin = index + MESSAGE_MAX_LENGTH_BYTES >= payload.length
        fragment = payload.slice(index, index + MESSAGE_MAX_LENGTH_BYTES)

        if (Buffer.isBuffer(fragment)) {
          // binary continuation frame
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, false, fin))
        } else if (ArrayBuffer.isView(fragment)) {
          // binary continuation frame
          const buffer = Buffer.from(fragment.buffer)
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, false, fin))
        } else if (typeof fragment == 'string') {
          // text continuation frame
          const buffer = Buffer.from(fragment, 'utf8')
          this._socket.write(encodeWebSocketFrame(fragment, 0x0, false, fin))
        } else {
          this.emit('error', new TypeError('send can only process binary or text frames'))
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
    this._socket.write(encodeWebSocketFrame(payload, 0x8)) // close frame
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
    this._socket.write(encodeWebSocketFrame(payload, 0x9)) // ping frame
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

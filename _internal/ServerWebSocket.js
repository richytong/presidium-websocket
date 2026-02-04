const events = require('events')
const zlib = require('zlib')
const encodeWebSocketFrame = require('./encodeWebSocketFrame')

/**
 * @name ServerWebsocket
 *
 * @docs
 * ```coffeescript [specscript]
 * module net 'https://nodejs.org/api/net.html'
 *
 * new ServerWebsocket(socket net.Socket, options {
 *   maxMessageLength: number
 *   socketBufferLength: number,
 * }) -> websocket ServerWebsocket
 * ```
 *
 * Presidium ServerWebSocket class. Used by Presidium [WebSocketServer](/docs/WebSocketServer) and [WebSocketSecureServer](/docs/WebSocketSecureServer) classes.
 *
 * Arguments:
 *   * `socket` - an instance of a [Node.js net.Socket](https://nodejs.org/docs/latest-v24.x/api/net.html#class-netsocket). Represents the server's underlying TCP connection to the client.
 *   * `options`
 *     * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
 *     * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
 *
 * Return:
 *   * `websocket` - a ServerWebSocket instance. Represents the server's WebSocket connection to the client.
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
   * @name Event: open
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('open')
   * ```
   *
   * The `open` event. Emitted when the WebSocket connection is open.
   *
   * Event Data:
   *   * (none)
   *
   * ```javascript
   * websocket.on('open', () => {
   *   console.log('Connection is open.')
   * })
   * ```
   */

  /**
   * @name Event: message
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('message', message Buffer)
   * ```
   *
   * The `message` event. Emitted upon receipt and successful decoding (and reassembly, if applicable) of an incoming message.
   *
   * Event Data:
   *   * `message` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) of the received message.
   *
   * ```javascript
   * websocket.on('message', message => {
   *   console.log('Message:', message.toString('utf8'))
   * })
   * ```
   */

  /**
   * @name Event: ping
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('ping', payload Buffer)
   * ```
   *
   * The `ping` event. Emitted upon receipt and successful decoding of an incoming "ping" message.
   *
   * Event Data:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) of the received payload.
   *
   * ```javascript
   * websocket.on('ping', () => {
   *   console.log('Ping')
   * })
   * ```
   */

  /**
   * @name Event: pong
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('pong', payload Buffer)
   * ```
   *
   * The `pong` event. Emitted upon receipt and successful decoding of an incoming "pong" message.
   *
   * Event Data:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) of the received payload.
   *
   * ```javascript
   * websocket.on('pong', () => {
   *   console.log('Pong')
   * })
   * ```
   */

  /**
   * @name Event: error
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('error', error Error)
   * ```
   *
   * The `error` event. Emitted if an error occurs on the ServerWebSocket instance or on its underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
   *
   * Event Data:
   *   * `error` - an instance of a JavaScript [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error).
   *
   * ```javascript
   * websocket.on('error', error => {
   *   console.error('Error:', error)
   * })
   * ```
   */

  /**
   * @name Event: close
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('close')
   * ```
   *
   * The `close` event. Emitted when the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) is destroyed.
   *
   * Event Data:
   *   * (none)
   *
   * ```javascript
   * websocket.on('close', () => {
   *   console.log('Connection is closed.')
   * })
   * ```
   */

  /**
   * @name connect
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.connect() -> undefined
   * ```
   *
   * Throws an error.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.connect()
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
   *
   * Sends a message to the client.
   *
   * Arguments:
   *   * `message` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the message to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.send('Example')
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
   * ```coffeescript [specscript]
   * websocket.sendClose() -> undefined
   * websocket.sendClose(payload Buffer|string) -> undefined
   * ```
   *
   * Sends a close frame to the client.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.sendClose()
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
   * ```coffeescript [specscript]
   * websocket.sendPing() -> undefined
   * websocket.sendPing(payload Buffer|string) -> undefined
   * ```
   *
   * Sends a ping frame to the client.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.sendPing()
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
   * ```coffeescript [specscript]
   * websocket.sendPong() -> undefined
   * websocket.sendPong(payload Buffer|string) -> undefined
   * ```
   *
   * Sends a pong frame to the client.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.sendPong()
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
   * ```coffeescript [specscript]
   * websocket.close() -> undefined
   * websocket.close(payload Buffer|string) -> undefined
   * ```
   *
   * Closes the connection to the client.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.close()
   * ```
   *
   */
  close(payload = Buffer.from([])) {
    this.readyState = 2 // CLOSING
    this.sendClose(payload)
  }

  /**
   * @name destroy
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.destroy() -> undefined
   * websocket.destroy(payload Buffer|string) -> undefined
   * ```
   *
   * Destroys the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * websocket.destroy()
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

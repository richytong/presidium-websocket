/**
 * presidium-websocket v3.0.0
 * https://github.com/richytong/presidium-websocket
 * (c) 2026 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const net = require('net')
const tls = require('tls')
const events = require('events')
const crypto = require('crypto')
const zlib = require('zlib')
const encodeWebSocketFrame = require('./_internal/encodeWebSocketFrame')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const decodeWebSocketHandshakeResponse = require('./_internal/decodeWebSocketHandshakeResponse')
const LinkedList = require('./_internal/LinkedList')
const __ = require('./_internal/placeholder')
const curry3 = require('./_internal/curry3')
const append = require('./_internal/append')
const call = require('./_internal/call')
const thunkify1 = require('./_internal/thunkify1')
const thunkify3 = require('./_internal/thunkify3')
const functionConcatSync = require('./_internal/functionConcatSync')

/**
 * @name WebSocket
 *
 * @docs
 * ```coffeescript [specscript]
 * new WebSocket(url string) -> websocket WebSocket
 *
 * new WebSocket(url string, options {
 *   rejectUnauthorized: boolean,
 *   autoConnect: boolean,
 *   maxMessageLength: number,
 *   socketBufferLength: number,
 *   offerPerMessageDeflate: boolean
 * }) -> websocket WebSocket
 * ```
 *
 * Presidium WebSocket class.
 *
 * Arguments:
 *   * `options`
 *     * `rejectUnauthorized` - if `true`, the client verifies the server's certificate against a list of pre-approved certificate authorities (CAs). An [error](#websocket-error-event) event is emitted if verification fails; `err.code` contains the OpenSSL error code. Defaults to `true`.
 *     * `autoConnect` - if `true`, establishes the underlying TCP connection automatically upon construction. Defaults to `true`.
 *     * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
 *     * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
 *     * `offerPerMessageDeflate` - if `true`, offers to the server [Per-Message Compression Extensions](https://datatracker.ietf.org/doc/html/rfc7692#section-4) by including the `Sec-WebSocket-Extensions: permessage-deflate` header in the initial WebSocket handshake. If the server supports compression extensions, all messages exchanged in the WebSocket connection will be compressed with [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `true`.
 *
 * Return:
 *   * `websocket` - a Presidium WebSocket instance.
 *
 * ```javascript
 * const websocket = new WebSocket('ws://localhost:1337/')
 * ```
 */
class WebSocket extends events.EventEmitter {
  constructor(url, options = {}) {
    super()

    const parsedUrl = new URL(url)

    if (parsedUrl.protocol != 'ws:' && parsedUrl.protocol != 'wss:') {
      throw new TypeError('URL protocol must be "ws" or "wss"')
    }

    this.url = {
      hostname: parsedUrl.hostname,
      protocol: parsedUrl.protocol,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash
    }
    if (parsedUrl.port.length > 0) {
      this.url.port = Number(parsedUrl.port)
    } else if (parsedUrl.protocol == 'wss:') {
      this.url.port = 443
    } else {
      this.url.port = 80
    }

    this._connectOptions = {
      rejectUnauthorized: options.rejectUnauthorized ?? true,
      servername: net.isIP(this.url.hostname) ? '' : this.url.hostname
    }

    this.on('error', () => {
      this.destroy()
    })

    this._maxMessageLength = options.maxMessageLength ?? 4 * 1024
    this._socketBufferLength = options.socketBufferLength ?? 100 * 1024
    this._offerPerMessageDeflate = options.offerPerMessageDeflate ?? true

    this.readyState = 3 // CLOSED

    this._autoConnect = options.autoConnect ?? true
    if (this._autoConnect) {
      this.connect()
    }

    this._continuationPayloads = []
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * The `error` event. Emitted if an error occurs on the WebSocket instance or on its underlying [socket](https://nodejs.org/api/net.html#class-netsocket).
   *
   * Event Data:
   *   * `error` - an instance of a JavaScript [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error).
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
   * Initiates a new connection to the WebSocket server.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
   * websocket.connect()
   * ```
   */
  connect() {
    if (this._socket) { // dispose existing
      this._socket.destroy()
    }

    if (this.url.protocol == 'wss:') {
      this._socket = tls.connect(
        {
          port: this.url.port,
          host: this.url.hostname,
          rejectUnauthorized: this._connectOptions.rejectUnauthorized,
          servername: this._connectOptions.servername,
          onread: {
            buffer: Buffer.alloc(this._socketBufferLength),
            callback: this._onread.bind(this)
          }
        },
        this._requestUpgrade.bind(this)
      )
    } else {
      this._socket = net.connect(
        {
          port: this.url.port,
          host: this.url.hostname,
          onread: {
            buffer: Buffer.alloc(this._socketBufferLength),
            callback: this._onread.bind(this)
          }
        },
        this._requestUpgrade.bind(this)
      )
    }

    this.readyState = 0 // CONNECTING

    this._socket.on('error', error => {
      this.emit('error', error)
    })

    this._handleDataFrames()
  }

  /**
   * @name _onread
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._onread(nread number, buffer Buffer) -> ()
   * ```
   */
  _onread(nread, buffer) {
    this._socket.emit('data', Buffer.from(buffer.slice(0, nread)))
  }

  /**
   * @name _requestUpgrade
   *
   * @docs
   * ```coffeescript [specscript]
   * _requestUpgrade() -> ()
   * ```
   */
  _requestUpgrade() {
    const key = crypto.randomBytes(16).toString('base64')

    this._socket.write(
      `GET ${this.url.pathname}${this.url.search}${this.url.hash} HTTP/1.1\r\nHost: ${this.url.hostname}:${this.url.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n${this._offerPerMessageDeflate ? 'Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits\r\n' : ''}\r\n`
    )
  }

  /**
   * @name _handleDataFrames
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._handleDataFrames() -> ()
   * ```
   */
  async _handleDataFrames() {
    const chunks = new LinkedList()

    this._socket.on('data', functionConcatSync(
      curry3(append, chunks, __, 'WebSocket'),
      thunkify1(
        process.nextTick,
        thunkify3(call, this._processChunk, this, chunks)
      )
    ))
  }

  /**
   * @name _processChunk
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._processChunk(chunks Array<Buffer>) -> ()
   * ```
   */
  async _processChunk(chunks) {
    if (this.readyState === 0) { // process handshake
      let chunk = chunks.shift()
      let decodeResult = decodeWebSocketHandshakeResponse(chunk)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketHandshakeResponse(chunk)
      }
      if (decodeResult == null) {
        chunks.prepend(chunk)
        return undefined
      }

      const {
        handshakeSucceeded,
        perMessageDeflate,
        message,
        remaining
      } = decodeResult

      if (!handshakeSucceeded) {
        this.destroy()
        this.emit('error', new Error(message))
        return undefined
      }

      if (perMessageDeflate) {
        this._perMessageDeflate = true
        this._socket._perMessageDeflate = true
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this.readyState = 1 // OPEN
      this.sendPing()
      this.emit('open')

      return undefined
    }

    // process data frames
    while (chunks.length > 0) {

      let chunk = chunks.shift()
      let decodeResult = await decodeWebSocketFrame.call(this, chunk, this._perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = await decodeWebSocketFrame.call(this, chunk, this._perMessageDeflate)
      }
      if (decodeResult == null) {
        chunks.prepend(chunk)
        return undefined
      }

      const { fin, opcode, payload, remaining, masked } = decodeResult

      // The client must close the connection upon receiving a frame that is masked
      if (masked) {
        this.sendClose('masked frame')
        this.destroy()
        break
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this._handleDataFrame(payload, opcode, fin)
    }

    return undefined
  }

  /**
   * @name _handleDataFrame
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._handleDataFrame(payload Buffer, opcode number, fin boolean) -> ()
   * ```
   */
  _handleDataFrame(payload, opcode, fin) {
    if (opcode === 0x0) { // continuation frame
      this._continuationPayloads.push(payload)
      if (fin) { // last continuation frame
        this.emit('message', Buffer.concat(this._continuationPayloads))
        this._continuationPayloads = []
      }
    } else if (fin) { // unfragmented message

      switch (opcode) {
        case 0x1: // text frame
        case 0x2: // binary frame
          this.emit('message', payload)
          break
        case 0x8: // close frame
          this.readyState = 2 // CLOSING
          if (this.sentClose) {
            this.destroy(payload)
          } else {
            this.sendClose()
            this.destroy(payload)
          }
          break
        case 0x9: // ping frame
          this.emit('ping', payload)
          this.sendPong(payload)
          break
        case 0xA: // pong frame
          this.emit('pong', payload)
          break
      }

    } else { // fragmented message, wait for continuation frames
      this._continuationPayloads.push(payload)
    }
  }

  /**
   * @name send
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket.send(message Buffer|string) -> undefined
   * ```
   * Sends a message to the WebSocket server.
   *
   * Arguments:
   *   * `message` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the message to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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
        true,
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
        true,
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
          true,
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
   * Sends a close frame to the WebSocket server.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
   * websocket.sendClose()
   * ```
   */
  sendClose(payload = Buffer.from([])) {
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0x8, true)) // close frame
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
   * Sends a ping frame to the server.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
   * websocket.sendPing()
   * ```
   */
  sendPing(payload = Buffer.from([])) {
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0x9, true)) // ping frame
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
   * Sends a pong frame to the server.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
   * websocket.sendPong()
   * ```
   */
  sendPong(payload = Buffer.from([])) {
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload)
    }
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0xA, true)) // pong frame
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
   * Closes the connection to the WebSocket server.
   *
   * Arguments:
   *   * `payload` - a [Node.js buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html) or string of the payload to send.
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
   * websocket.close()
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
   * const websocket = new WebSocket('ws://localhost:1337/')
   *
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

module.exports = WebSocket

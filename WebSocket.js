/**
 * presidium-websocket v0.2.3
 * https://github.com/richytong/presidium-websocket
 * (c) 2025 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const net = require('net')
const tls = require('tls')
const events = require('events')
const crypto = require('crypto')
const encodeWebSocketFrame = require('./_internal/encodeWebSocketFrame')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const decodeWebSocketHandshakeResponse = require('./_internal/decodeWebSocketHandshakeResponse')
const unhandledErrorListener = require('./_internal/unhandledErrorListener')
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
 * Creates a Presidium WebSocket client.
 *
 * ```coffeescript [specscript]
 * new WebSocket(url string) -> websocket WebSocket
 *
 * new WebSocket(url string, options {
 *   rejectUnauthorized: boolean,
 *   autoConnect: boolean,
 *   maxMessageLength: number,
 *   requestPerMessageDeflate: boolean
 * }) -> websocket WebSocket
 *
 * websocket.on('open', ()=>()) -> ()
 * websocket.on('message', (message Buffer)=>()) -> ()
 * websocket.on('ping', ()=>()) -> ()
 * websocket.on('pong', ()=>()) -> ()
 * websocket.on('error', (error Error)=>()) -> ()
 * websocket.on('close', ()=>()) -> ()
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

    this.on('error', unhandledErrorListener.bind(this))

    this._maxMessageLength = options.maxMessageLength ?? 4 * 1024
    this._socketBufferLength = options.socketBufferLength ?? 100 * 1024
    this._requestPerMessageDeflate = options.requestPerMessageDeflate ?? true

    this.readyState = 3 // CLOSED

    this._autoConnect = options.autoConnect ?? true
    if (this._autoConnect) {
      this.connect()
    }

    this._continuationPayloads = []
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
            buffer: Buffer.alloc(3 * 1024 * 1024),
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
      this.destroy()
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
      `GET ${this.url.pathname} HTTP/1.1\r\nHost: ${this.url.hostname}:${this.url.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n${this._requestPerMessageDeflate ? 'Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits\r\n' : ''}\r\n`
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
  _processChunk(chunks) {
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
      let decodeResult = decodeWebSocketFrame.call(this, chunk, this._perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketFrame.call(this, chunk, this._perMessageDeflate)
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

    if (buffer.length <= this._maxMessageLength) { // unfragmented
      this._socket.write(encodeWebSocketFrame.call(
        this,
        buffer,
        opcode,
        true,
        true,
        this._perMessageDeflate
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
        this._perMessageDeflate
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
          this._perMessageDeflate
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
   * Sends close frame to the server
   *
   * ```coffeescript [specscript]
   * websocket.sendClose(payload Buffer|string) -> ()
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
   * Sends a ping frame to the server
   *
   * ```coffeescript [specscript]
   * websocket.sendPing(payload Buffer|string) -> ()
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
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0xA, true)) // pong frame
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
   * websocket.destroy(Buffer|string) -> ()
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

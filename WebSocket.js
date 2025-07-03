/**
 * presidium-websocket v0.0.10
 * https://github.com/richytong/presidium-websocket
 * (c) 2025 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const net = require('net')
const tls = require('tls')
const events = require('events')
const crypto = require('crypto')
const sleep = require('./_internal/sleep')
const encodeWebSocketFrame = require('./_internal/encodeWebSocketFrame')
const decodeWebSocketFrame = require('./_internal/decodeWebSocketFrame')
const decodeWebSocketHandshakeResponse = require('./_internal/decodeWebSocketHandshakeResponse')
const unhandledErrorListener = require('./_internal/unhandledErrorListener')
const LinkedList = require('./_internal/LinkedList')
const __ = require('./_internal/placeholder')
const curry2 = require('./_internal/curry2')
const curry3 = require('./_internal/curry3')
const append = require('./_internal/append')
const call = require('./_internal/call')
const thunkify1 = require('./_internal/thunkify1')
const thunkify3 = require('./_internal/thunkify3')
const functionConcatSync = require('./_internal/functionConcatSync')

const MESSAGE_MAX_LENGTH_BYTES = 1024 * 1024

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
 *   rejectUnauthorized: boolean
 * }) -> websocket WebSocket
 * ```
 *
 * ```javascript
 * const myWebsocket = new WebSocket('wss://echo.websocket.org/')
 *
 * myWebsocket.on('open', () => {
 *   myWebsocket.send('Hello Server!')
 * })
 *
 * myWebsocket.on('message', message => {
 *   console.log('Message from server:', message)
 * })
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

    this.readyState = 0 // CONNECTING

    this._connectOptions = {
      rejectUnauthorized: options.rejectUnauthorized ?? true,
      servername: net.isIP(this.url.hostname) ? '' : this.url.hostname
    }

    this.on('error', unhandledErrorListener.bind(this))

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
      this.readyState = 0 // CONNECTING
      this._socket.destroy()
    }

    if (this.url.protocol == 'wss:') {
      this._socket = tls.connect(
        {
          port: this.url.port,
          host: this.url.hostname,
          rejectUnauthorized: this._connectOptions.rejectUnauthorized,
          servername: this._connectOptions.servername
        },
        this._handleTCPConnection.bind(this)
      )
    } else {
      this._socket = net.connect(
        this.url.port,
        this.url.hostname,
        this._handleTCPConnection.bind(this)
      )
    }

    this._socket.on('error', error => {
      this.emit('error', error)
    })

    this._handleDataFrames()
  }

  /**
   * @name _handleTCPConnection
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._handleTCPConnection() -> ()
   * ```
   */
  _handleTCPConnection() {
    const key = crypto.randomBytes(16).toString('base64')
    this._socket.write(
      `GET ${this.url.pathname} HTTP/1.1\r\nHost: ${this.url.hostname}:${this.url.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Extensions: permessage-deflate; client_max_window_bits\r\n\r\n`
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

    /*
    this._socket.on('data', functionConcatSync(
      curry3(append, chunks, __, 'WebSocket'),
      thunkify1(
        process.nextTick,
        thunkify3(call, this._processChunk, this, chunks)
      )
    ))
    */

    this._socket.pause()
    while (!this.closed) {
      // console.log('WebSocket call this._readSocket')
      this._readSocket(chunks)
      await sleep(2)
    }

    /*
    while (!this.closed) {
      const chunk = this._socket.read()
      if (chunk == null) {
        console.log('WebSocket socket.read null')
        await sleep(0)
        continue
      }

      chunks.append(chunk)
      // this._processChunk(chunks)
      process.nextTick(thunkify3(call, this._processChunk, this, chunks))

      await sleep(0)
    }
    */

  }

  /**
   * @name _readSocket
   *
   * @docs
   * ```coffeescript [specscript]
   * _readSocket(chunks Array<Buffer>) -> ()
   * ```
   */
  _readSocket(chunks) {
    const chunk = this._socket.read()
    if (chunk == null) {
      console.log('WebSocket _readSocket null')
      return undefined
    }
    // console.log('WebSocket _readSocket', chunk)

    chunks.append(chunk)

    process.nextTick(thunkify3(
      call,
      this._processChunk,
      this,
      chunks
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
    if (this._socket.destroyed) {
      // console.log('WebSocket _processChunk socket destroyed')
      return undefined
    }

    if (chunks.length == 0) {
      // console.log('WebSocket _processChunk no chunks')
      return undefined
    }

    // console.log('WebSocket _processChunk')

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
        this.emit('error', new Error(message))
        return undefined
      }

      if (perMessageDeflate) {
        this.perMessageDeflate = true
        this._socket.perMessageDeflate = true
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this.readyState = 1 // OPEN
      this.emit('open')

      return undefined
    }

    // process data frames
    while (chunks.length > 0) {

      let chunk = chunks.shift()
      let decodeResult = decodeWebSocketFrame.call(this, chunk, this.perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketFrame.call(this, chunk, this.perMessageDeflate)
      }
      if (decodeResult == null) {
        chunks.prepend(chunk)
        return undefined
      }

      const { fin, opcode, payload, remaining, masked } = decodeResult

      // console.log('WebSocket _processChunk', payload.toString())

      // The client must close the connection upon receiving a frame that is masked
      if (masked) {
        this.close()
        return undefined
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this._handleDataFrame(payload, opcode, fin)
    }

    return undefined
  }

  /**
   * @name _processChunks
   *
   * @docs
   * ```coffeescript [specscript]
   * websocket._processChunks(chunks Array<Buffer>) -> ()
   * ```
   */
  async _processChunks(chunks) {
    while (!this.closed) {
      // handle handshake response

      if (chunks.length == 0) {
        if (this._socket.destroyed) {
          this.readyState = 3 // CLOSED
          break
        }
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
        chunks.prepend(chunk)
        await sleep(0)
        continue
      }

      const {
        handshakeSucceeded,
        perMessageDeflate,
        message,
        remaining
      } = decodeResult

      if (!handshakeSucceeded) {
        this.emit('error', new Error(message))
        break
      }

      if (perMessageDeflate) {
        this.perMessageDeflate = true
        this._socket.perMessageDeflate = true
      }

      if (remaining.length > 0) {
        chunks.prepend(remaining)
      }

      this.readyState = 1 // OPEN
      this.emit('open')

      await sleep(0)
      break
    }

    while (!this.closed) {
      // handle data frames

      if (chunks.length == 0) {
        if (this._socket.destroyed) {
          this.readyState = 3 // CLOSED
          break
        }
        await sleep(0)
        continue
      }

      let chunk = chunks.shift()
      let decodeResult = decodeWebSocketFrame.call(this, chunk, this.perMessageDeflate)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketFrame.call(this, chunk, this.perMessageDeflate)
      }

      if (decodeResult == null) {
        chunks.prepend(chunk)
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
        chunks.prepend(remaining)
      }

      this._handleDataFrame(payload, opcode, fin)

      await sleep(0)
    }

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
            this.destroy()
          } else {
            this.sendClose()
            this.destroy()
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

    if (buffer.length < MESSAGE_MAX_LENGTH_BYTES) { // unfragmented
      this._socket.write(encodeWebSocketFrame.call(
        this,
        buffer,
        opcode,
        true,
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
        true,
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
          true,
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
    this._socket.write(encodeWebSocketFrame.call(this, payload, 0x8, true)) // close frame
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
   * websocket.destroy() -> ()
   * ```
   */
  destroy() {
    this._socket.destroy()
    this.readyState = 3 // CLOSED
    this.closed = true
    this.emit('close')
  }
}

module.exports = WebSocket

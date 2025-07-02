/**
 * presidium-websocket v0.0.9
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

    if (this.url.protocol == 'wss:') {
      this._socket = tls.connect(
        {
          port: this.url.port,
          host: this.url.hostname,
          rejectUnauthorized: options.rejectUnauthorized ?? true,
          servername: net.isIP(this.url.hostname) ? '' : this.url.hostname,
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

    this._handleDataFrames()

    this.on('error', unhandledErrorListener.bind(this))

    this._socket.on('error', error => {
      this.emit('error', error)
    })
  }

  /**
   * @name _handleTCPConnection
   *
   * @docs
   * ```coffeescript [specscript]
   * _handleTCPConnection() -> ()
   * ```
   */
  _handleTCPConnection() {
    const key = crypto.randomBytes(16).toString('base64')
    const headers = [
      `GET ${this.url.pathname} HTTP/1.1`,
      `Host: ${this.url.hostname}:${this.url.port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits'
    ]
    this._socket.write(headers.join('\r\n') + '\r\n\r\n')
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
          chunks.unshift(remaining)
        }

        this.readyState = 1 // OPEN
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

        let chunk
        let decodeResult
        try {
          chunk = chunks.shift()
          decodeResult = decodeWebSocketFrame(chunk, this.perMessageDeflate)
          while (decodeResult == null && chunks.length > 0) {
            chunk = Buffer.concat([chunk, chunks.shift()])
            decodeResult = decodeWebSocketFrame(chunk, this.perMessageDeflate)
          }
        } catch (error) {
          this.emit('error', error)
          break
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
      this._socket.write(encodeWebSocketFrame(
        buffer,
        opcode,
        true,
        true,
        this.perMessageDeflate
      ))
    } else { // fragmented
      let index = 0
      let fragment = buffer.slice(0, MESSAGE_MAX_LENGTH_BYTES)
      this._socket.write(encodeWebSocketFrame(
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

        this._socket.write(encodeWebSocketFrame(
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

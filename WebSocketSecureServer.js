/**
 * presidium-websocket v1.0.1
 * https://github.com/richytong/presidium-websocket
 * (c) 2025 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const WebSocketServer = require('./WebSocketServer')

/**
 * @name WebSocketSecureServer
 *
 * @docs
 * ```coffeescript [specscript]
 * module http 'https://nodejs.org/api/http.html'
 * module net 'https://nodejs.org/api/net.html'
 *
 * type WebSocketHandler = (websocket WebSocket)=>undefined
 * type HTTPHandler = (request http.ClientRequest, response http.ServerResponse)=>undefined
 *
 * new WebSocketSecureServer(websocketHandler WebSocketHandler, options 
 *   httpHandler: HTTPHandler,
 *   key: string|Array<string>|Buffer|Array<Buffer>|Array<{
 *     pem: string|Buffer,
 *     passphrase: string
 *   }>,
 *   cert: string|Array<string>|Buffer|Array<Buffer>,
 *   passphrase: string,
 *   supportPerMessageDeflate: boolean,
 *   maxMessageLength: number
 *   socketBufferLength: number
 * }) -> server WebSocketSecureServer
 *
 * new WebSocketSecureServer(options {
 *   websocketHandler: WebSocketHandler,
 *   httpHandler: HTTPHandler,
 *   key: string|Array<string>|Buffer|Array<Buffer>|Array<{
 *     pem: string|Buffer,
 *     passphrase: string
 *   }>,
 *   cert: string|Array<string>|Buffer|Array<Buffer>,
 *   passphrase: string,
 *   supportPerMessageDeflate: boolean,
 *   maxMessageLength: number
 *   socketBufferLength: number
 * }) -> server WebSocketSecureServer
 * ```
 *
 * Presidium WebSocketSecureServer class.
 *
 * Arguments:
 *   * `websocketHandler` - a handler function that expects an instance of a [`ServerWebSocket`](/docs/ServerWebSocket). Represents the server's WebSocket connection to the client.
 *   * `options`
 *     * `httpHandler` - function that processes incoming HTTP requests from clients. Defaults to an HTTP handler that responds with `200 OK`.
 *     * `key` - private key(s) in PEM format. Encrypted keys will be decrypted using the `passphrase` option. Multiple keys using different algorithms can be provided as an array of unencrypted key strings or buffers, or an array of objects in the form `{ pem: string|Buffer, passphrase: string }`.
 *     * `cert` - cert chain(s) in PEM format. One cert chain should be provided per private key.
 *     * `passphrase` - used to decrypt the private key(s).
 *     * `supportPerMessageDeflate` - if `true`, indicates to WebSocket clients that the server supports [Compression Extensions for WebSocket](https://datatracker.ietf.org/doc/html/rfc7692). If an incoming WebSocket connection has requested compression extensions via the `Sec-WebSocket-Extensions: permessage-deflate` header, all messages exchanged in the WebSocket connection will be compressed using [zlib](https://nodejs.org/api/zlib.html) default options. Defaults to `false`.
 *     * `maxMessageLength` - the maximum length in bytes of sent messages. If a message is longer than `maxMessageLength`, it is split into fragmented messages that are reassembled by the receiver.
 *     * `socketBufferLength` - length in bytes of the internal buffer of the underlying [socket](https://nodejs.org/api/net.html#class-netsocket) for all connections to the server.
 *
 * Return:
 *   * `server` - an instance of the WebSocketSecureServer.
 *
 * ```javascript
 * const server = new WebSocketSecureServer({
 *   key: fs.readFileSync('/path/to/my-key'),
 *   cert: fs.readFileSync('/path/to/my-cert'),
 * })
 *
 * server.listen(4443, () => {
 *   console.log('WebSocket secure server listening on port 4443')
 * })
 * ```
 */
class WebSocketSecureServer extends WebSocketServer {
  constructor(...args) {
    const options =
      typeof args[0] == 'object' ? args[0]
      : typeof args[1] == 'object' ? args[1]
      : undefined

    if (options == null || options.key == null || options.cert == null) {
      throw new TypeError('invalid key and cert options')
    }

    const websocketHandler =
      typeof args[0] == 'function' ? args[0]
      : options?.websocketHandler ? options.websocketHandler
      : undefined

    super(websocketHandler, { ...options, secure: true })
  }
}

module.exports = WebSocketSecureServer

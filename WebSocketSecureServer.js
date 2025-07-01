const WebSocketServer = require('./WebSocketServer')

/**
 * @name WebSocketSecureServer
 *
 * @docs
 * ```coffeescript [specscript]
 * websocketHandler (websocket WebSocket)=>()
 * httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
 *
 * new WebSocketSecureServer(websocketHandler, options {
 *   httpHandler: httpHandler,
 *   key: string,
 *   cert: string
 * }) -> server WebSocket.Server
 *
 * new WebSocketSecureServer(options {
 *   websocketHandler: websocketHandler,
 *   httpHandler: httpHandler,
 *   key: string,
 *   cert: string
 * }) -> server WebSocket.Server
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

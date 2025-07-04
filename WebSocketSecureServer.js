/**
 * presidium-websocket v0.1.2
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
 * websocketHandler (websocket WebSocket)=>()
 * httpHandler (request http.ClientRequest, response http.ServerResponse)=>()
 * upgradeHandler (request http.ClientRequest, socket net.Socket, head Buffer)=>()
 *
 * new WebSocketSecureServer(options {
 *   key: string,
 *   cert: string
 * }) -> server WebSocketSecureServer
 *
 * new WebSocketSecureServer(websocketHandler, options {
 *   httpHandler: httpHandler,
 *   key: string,
 *   cert: string
 * }) -> server WebSocketSecureServer
 *
 * new WebSocketSecureServer(options {
 *   websocketHandler: websocketHandler,
 *   httpHandler: httpHandler,
 *   key: string,
 *   cert: string
 * }) -> server WebSocketSecureServer
 *
 * server.on('connection', websocketHandler) -> ()
 * server.on('request', httpHandler) -> ()
 * server.on('upgrade', upgradeHandler) -> ()
 * server.on('error', (error Error)=>()) -> ()
 * server.on('close', ()=>()) -> ()
 *
 * server.on('connection', (websocket WebSocket) => {
 *   websocket.on('open', ()=>()) -> ()
 *   websocket.on('message', (message Buffer)=>()) -> ()
 *   websocket.on('ping', ()=>()) -> ()
 *   websocket.on('pong', ()=>()) -> ()
 *   websocket.on('error', (error Error)=>()) -> ()
 *   websocket.on('close', ()=>()) -> ()
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

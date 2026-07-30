/**
 * Presidium Websocket may be freely distributed under the CFOSS license.
 */

const WebSocket = require('./WebSocket')
const WebSocketServer = require('./WebSocketServer')
const WebSocketSecureServer = require('./WebSocketSecureServer')

WebSocket.Server = WebSocketServer
WebSocket.SecureServer = WebSocketSecureServer

module.exports = WebSocket

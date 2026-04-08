/**
 * presidium-websocket v3.2.1
 * https://github.com/richytong/presidium-websocket
 * (c) Richard Tong
 * presidium-websocket may be freely distributed under the CFOSS license.
 */

const WebSocket = require('./WebSocket')
const WebSocketServer = require('./WebSocketServer')
const WebSocketSecureServer = require('./WebSocketSecureServer')

WebSocket.Server = WebSocketServer
WebSocket.SecureServer = WebSocketSecureServer

module.exports = WebSocket

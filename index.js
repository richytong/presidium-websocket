/**
 * presidium-websocket v3.0.0
 * https://github.com/richytong/presidium-websocket
 * (c) 2026 Richard Tong
 * presidium-websocket may be freely distributed under the MIT license.
 */

const WebSocket = require('./WebSocket')
const WebSocketServer = require('./WebSocketServer')
const WebSocketSecureServer = require('./WebSocketSecureServer')

WebSocket.Server = WebSocketServer
WebSocket.SecureServer = WebSocketSecureServer

module.exports = WebSocket

const net = require('net')
const generateWebSocketKey = require('./_internal/generateWebSocketKey')

/**
 * @name WebSocket
 *
 * @docs
 * Creates a Presidium WebSocket client.
 *
 * ```coffeescript [specscript]
 * new WebSocket(url string) -> websocket WebSocket
 * ```
 *
 * ```javascript
 * const myWebsocket = new WebSocket('wss://echo.websocket.org/')
 *
 * myWebsocket.addEventListener('open', function (event) {
 *   myWebsocket.send('Hello Server!')
 * })
 *
 * myWebsocket.addEventListener('message', function (event) {
 *   console.log('Message from server:', event.data)
 * })
 * ```
 */
class WebSocket {
  constructor(url) {
    const { port, hostname, host, protocol, pathname } = new URL(url)

    if (protocol != 'ws:' || protocol != 'wss:') {
      throw new Error('URL protocol must be "ws" or "wss"')
    }

    this._socket = net.createConnection(port, hostname, async () => {
      console.log('TCP connection established!')

      const key = await generateWebSocketKey()

      const headers = [
        `GET ${pathname} HTTP/1.1`,
        `Host: ${host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13'
      ]

      this._socket.write(headers.join('\r\n') + '\r\n\r\n')
    })
  }
}

module.exports = WebSocket

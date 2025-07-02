const assert = require('assert')
const decodeWebSocketHandshakeResponse = require('./decodeWebSocketHandshakeResponse')

describe('decodeWebSocketHandshakeResponse', () => {
  it('Decodes the WebSocket handshake response', async () => {
    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: key`,
      'Sec-WebSocket-Extensions: permessage-deflate'
    ]
    const s = headers.join('\r\n') + '\r\n\r\n'
    const buffer = Buffer.from(s)

    const decodeResult = decodeWebSocketHandshakeResponse(buffer)
    assert.strictEqual(decodeResult.handshakeSucceeded, true)
    assert.strictEqual(decodeResult.perMessageDeflate, true)
    assert.equal(decodeResult.message, s)
    assert.equal(decodeResult.remaining.length, 0)

    assert.strictEqual(
      decodeWebSocketHandshakeResponse(Buffer.from([])),
      undefined
    )
  })

})

/**
 * @name decodeWebSocketHandshakeResponse
 *
 * @docs
 * ```coffeescript [specscript]
 * decodeWebSocketHandshakeResponse(buffer Buffer) -> decodeResult? {
 *   handshakeSucceeded: boolean,
 *   remaining: Buffer,
 * }
 * ```
 */
function decodeWebSocketHandshakeResponse(buffer) {
  const s = buffer.toString('utf8')

  if (s.includes('HTTP/1.1') && s.includes('\r\n\r\n')) {
    const index = s.indexOf('\r\n\r\n') + 4
    return {
      handshakeSucceeded: s.includes('101 Switching Protocols'),
      perMessageDeflate: s.includes('permessage-deflate'),
      message: s.slice(0, index),
      remaining: buffer.slice(index)
    }
  }

  return undefined
}

module.exports = decodeWebSocketHandshakeResponse

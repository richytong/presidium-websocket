/**
 * @name decodeWebSocketFrame
 *
 * @docs
 * ```coffeescript [specscript]
 * decodeWebSocketFrame(buffer Buffer) -> decodeResult? {
 *   fin: boolean,
 *   opcode: number,
 *   payload: Buffer,
 *   remaining: Buffer,
 *   masked: boolean,
 * }
 * ```
 */
function decodeWebSocketFrame(buffer) {
  if (buffer.length < 2) {
    return undefined
  }

  const firstByte = buffer[0]
  const fin = (firstByte & 0x80) !== 0
  const opcode = firstByte & 0x0f
  const secondByte = buffer[1]
  const masked = (secondByte & 0x80) !== 0
  let payloadLen = secondByte & 0x7f
  let offset = 2

  if (payloadLen === 126) {
    if (buffer.length < offset + 2) {
      return undefined
    }
    payloadLen = buffer.readUInt16BE(offset)
    offset += 2
  } else if (payloadLen === 127) {
    if (buffer.length < offset + 8) {
      return undefined
    }
    payloadLen = Number(buffer.readBigUInt64BE(offset))
    offset += 8
  }

  if (buffer.length < offset + (masked ? 4 : 0) + payloadLen) {
    return undefined
  }

  let maskingKey = null

  if (masked) {
    maskingKey = buffer.slice(offset, offset + 4)
    offset += 4
  }

  let payload = buffer.slice(offset, offset + payloadLen)

  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4]
    }
  }

  const remaining = buffer.slice(offset + payloadLen)

  return { fin, opcode, payload, remaining, masked }
}

module.exports = decodeWebSocketFrame

const zlib = require('zlib')

/**
 * @name decodeWebSocketFrame
 *
 * @docs
 * ```coffeescript [specscript]
 * decodeWebSocketFrame(
 *   buffer Buffer,
 *   perMessageDeflate boolean
 * ) -> decodeResult? {
 *   fin: boolean,
 *   opcode: number,
 *   payload: Buffer,
 *   remaining: Buffer,
 *   masked: boolean,
 * }
 * ```
 */

function decodeWebSocketFrame(buffer, perMessageDeflate = false) {
  if (buffer.length < 2) {
    return undefined
  }

  const firstByte = buffer[0]
  const fin = (firstByte & 0x80) !== 0
  const rsv1 = (firstByte & 0x40) !== 0
  const opcode = firstByte & 0x0f
  const secondByte = buffer[1]
  const masked = (secondByte & 0x80) !== 0

  // An endpoint MUST NOT set the "Per-Message Compressed" bit of control
  // frames and non-first fragments (continuation frames) of a data message.
  if (rsv1 && opcode === 0x00) {
    this.sendClose('RSV1 must not be set for continuation frames')
    this.emit('error', new Error('RSV1 must not be set for continuation frames'))
    return undefined
  }

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

  if (perMessageDeflate && (rsv1 || opcode === 0x00) && payload.length > 0) {
    try {
      const tail = Buffer.from([0x00, 0x00, 0xff, 0xff])
      const compressed = Buffer.concat([payload, tail])
      payload = zlib.inflateRawSync(compressed)
    } catch (error) {
      this.emit('error', error)
    }
  }

  const remaining = buffer.slice(offset + payloadLen)

  return {
    fin,
    opcode,
    payload,
    remaining,
    masked,
    compressed: perMessageDeflate && rsv1
  }
}

module.exports = decodeWebSocketFrame

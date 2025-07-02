const crypto = require('crypto')
const zlib = require('zlib')

/**
 * @name encodeWebSocketFrame
 *
 * @synopsis
 * ```coffeescript [specscript]
 * encodeWebSocketFrame(
 *   payload Buffer,
 *   opcode number,
 *   mask? boolean,
 *   fin? boolean,
 *   perMessageDeflate? boolean
 * ) -> Buffer
 * ```
 */

function encodeWebSocketFrame(
  payload,
  opcode,
  mask = false,
  fin = true,
  perMessageDeflate = false
) {
  let compressed = false

  if (perMessageDeflate && payload.length > 0) {
    try {
      const compressedPayload = zlib.deflateRawSync(payload)
      if (
        compressedPayload.length >= 4 &&
        compressedPayload.slice(-4).equals(Buffer.from([0x00, 0x00, 0xff, 0xff]))
      ) {
        payload = compressedPayload.slice(0, -4)
      } else {
        payload = compressedPayload
      }
      compressed = true
    } catch (error) {
      this.emit('error', error)
    }
  }

  const payloadLen = payload.length
  let header = []

  let firstByte = (fin ? 0x80 : 0x00) | (compressed ? 0x40 : 0x00) | opcode
  header.push(firstByte)

  let secondByte = mask ? 0x80 : 0x00

  if (payloadLen < 126) {
    secondByte |= payloadLen
    header.push(secondByte)
  } else if (payloadLen < 65536) {
    secondByte |= 126
    header.push(secondByte)
    header.push((payloadLen >> 8) & 0xff)
    header.push(payloadLen & 0xff)
  } else {
    secondByte |= 127
    header.push(secondByte)
    const lenBuffer = Buffer.alloc(8)
    lenBuffer.writeBigUInt64BE(BigInt(payloadLen), 0)
    header = header.concat([...lenBuffer])
  }

  if (mask) {
    const maskingKey = crypto.randomBytes(4)
    const maskedPayload = Buffer.alloc(payload.length)
    for (let i = 0; i < payload.length; i++) {
      maskedPayload[i] = payload[i] ^ maskingKey[i % 4]
    }
    return Buffer.concat([Buffer.from(header), maskingKey, maskedPayload])
  }

  return Buffer.concat([Buffer.from(header), payload])
}

module.exports = encodeWebSocketFrame

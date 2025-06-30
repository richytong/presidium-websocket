const Byte = require('./Byte')

/**
 * @name Frame
 *
 * @docs
 * Methods for the binary WebSocket frame
 */
const Frame = {
  isFrameStart(chunk) {
    const s = decimalToBinaryNumberString(chunk[0])

    // const FIN = s[0]
    const RSV1 = s[1]
    const RSV2 = s[2]
    const RSV3 = s[3]

    if (RSV1 !== '0' || RSV2 !== '0' || RSV3 !== '0') {
      return false
    }

    const opCode = s.slice(4, 8)

      binaryNumberString[1] === 0
      && binaryNumberString[2] === 0
      && binaryNumberString[3] === 0
    const opCode = binaryNumberString.slice(4)
  }
}

const buf = Buffer.from([])
console.log(Frame.isFrameStart())

module.exports = Frame

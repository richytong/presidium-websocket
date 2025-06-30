/**
 * @name Byte
 *
 * @docs
 * A byte is a group of 8 bits
 *
 * ```coffeescript [specscript]
 * Byte.isBit8Set(byte Buffer|Uint8Array) -> boolean
 * ```
 */
const Byte = {

  isBit1Set(byte) {
    return (byte & 1) === 1
  },

  isBit2Set(byte) {
    const mask = 1 << 1
    return (byte & mask) !== 0
  },

  isBit3Set(byte) {
    const mask = 1 << 2
    return (byte & mask) !== 0
  },

  isBit4Set(byte) {
    const mask = 1 << 3
    return (byte & mask) !== 0
  },

  isBit5Set(byte) {
    const mask = 1 << 4
    return (byte & mask) !== 0
  },

  isBit6Set(byte) {
    const mask = 1 << 5
    return (byte & mask) !== 0
  },

  isBit7Set(byte) {
    const mask = 1 << 6
    return (byte & mask) !== 0
  },

  isBit8Set(byte) {
    const MSB_MASK = 128
    return (byte & MSB_MASK) === MSB_MASK
  }
}

module.exports = Byte

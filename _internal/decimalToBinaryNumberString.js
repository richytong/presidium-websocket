/**
 * @name decimalToBinaryNumberString
 *
 * @docs
 * Get the binary number string representation of a decimal number
 *
 * ```coffeescript [specscript]
 * decimalToBinaryNumberString(n number) -> binaryString string
 * ```
 */
function decimalToBinaryNumberString(number) {
  return number.toString(2).padStart(8, '0')
}

module.exports = decimalToBinaryNumberString

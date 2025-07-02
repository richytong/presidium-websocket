/**
 * @name append
 *
 * @docs
 * ```coffeescript [specscript]
 * append(array Array, element any) -> ()
 * ```
 */
function append(array, element) {
  array.push(element)
}

module.exports = append

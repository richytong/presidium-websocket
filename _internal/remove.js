/**
 * @name remove
 *
 * @docs
 * ```coffeescript [specscript]
 * remove(array Array, element any) -> ()
 * ```
 */
function remove(array, element) {
  array.splice(array.indexOf(element), 1)
}

module.exports = remove

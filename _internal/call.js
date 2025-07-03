/**
 * @name call
 *
 * @docs
 * ```coffeescript [specscript]
 * args Array
 *
 * call(fn function, thisArg object, ...args) -> any
 * ```
 */
function call(fn, thisArg, ...args) {
  return fn.call(thisArg, ...args)
}

module.exports = call

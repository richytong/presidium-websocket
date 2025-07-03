/**
 * @name functionConcatSync
 *
 * @synopsis
 * ```coffeescript [specscript]
 * functionConcatSync(fn1 function, fn2 function) -> concatenated function
 * ```
 */
const functionConcatSync = (fn1, fn2) => function _concatenated(...args) {
  return fn2(fn1(...args))
}

module.exports = functionConcatSync

/**
 * @name push
 *
 * @docs
 * ```coffeescript [specscript]
 * push(col { push: function }, element any) -> ()
 * ```
 */
function push(col, element, source) {
  col.push(element)
}

module.exports = push

/**
 * @name append
 *
 * @docs
 * ```coffeescript [specscript]
 * append(col { append: function }, element any) -> ()
 * ```
 */
function append(col, element) {
  col.append(element)
}

module.exports = append

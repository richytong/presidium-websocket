/**
 * @name _onread
 *
 * @docs
 * ```coffeescript [specscript]
 * _onread(nread number, buffer Buffer) -> ()
 * ```
 */
function _onread(nread, buffer) {
  // console.log('server _onread', nread)
  this.emit('data', Buffer.from(buffer.slice(0, nread)))
}

module.exports = _onread

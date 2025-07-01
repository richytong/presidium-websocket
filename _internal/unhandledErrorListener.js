/**
 * @name unhandledErrorListener
 *
 * @docs
 * Exits the process on error if this is the only listener for the error event.
 *
 * ```coffeescript [specscript]
 * unhandledErrorListener(error Error) -> ()
 * ```
 */
function unhandledErrorListener(error) {
  const errorListenerCount = this.listenerCount('error')
  const errorListeners = this.listeners('error')
  if (errorListenerCount == 1 && errorListeners[0] == unhandledErrorListener) {
    console.error(error)
    process.exit(1)
  }
}

module.exports = unhandledErrorListener

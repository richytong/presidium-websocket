const crypto = require('crypto')

/**
 * @name generateWebSocketKey
 *
 * @docs
 * Generate a WebSocket key for use in the `Sec-WebSocket-Key` header
 *
 * ```coffeescript [specscript]
 * generateWebSocketKey() -> key Promise<string>
 * ```
 */
function generateWebSocketKey() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (error, buffer) => {
      if (error) {
        reject(error)
      } else {
        const key = buffer.toString('base64')
        resolve(key)
      }
    })
  })
}

module.exports = generateWebSocketKey

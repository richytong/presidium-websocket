const zlib = require('zlib')

/**
 * @name inflateRawWithFlush
 *
 * @docs
 * ```coffeescript [specscript]
 * inflateRawWithFlush(compressed Buffer) -> decompressed Promise<buffer>
 * ```
 */
async function inflateRawWithFlush(compressed) {
  const inflate = zlib.createInflateRaw()
  inflate.write(compressed)

  const chunks = []
  inflate.on('data', chunk => {
    chunks.push(chunk)
  })

  return new Promise(resolve => {
    inflate.flush(() => {
      resolve(Buffer.concat(chunks))
    })
  })
}

module.exports = inflateRawWithFlush

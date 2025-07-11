const zlib = require('zlib')

/**
 * @name deflateRawWithFlush
 *
 * @docs
 * ```coffeescript [specscript]
 * deflateRawWithFlush(payload Buffer) -> decompressed Promise<buffer>
 * ```
 */
async function deflateRawWithFlush(payload) {
  const deflate = zlib.createDeflateRaw()
  deflate.write(payload)

  const chunks = []
  deflate.on('data', chunk => {
    chunks.push(chunk)
  })

  return new Promise(resolve => {
    deflate.flush(() => {
      resolve(Buffer.concat(chunks))
    })
  })
}

module.exports = deflateRawWithFlush

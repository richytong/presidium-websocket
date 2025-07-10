const ReadStream = {}

/**
 * @name ReadStream.Buffer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * module stream
 *
 * ReadStream.Buffer(readable stream.Readable) -> Promise<Buffer>
 * ```
 *
 * ```javascript
 * const buffer = await ReadStream.Buffer(readable)
 * ```
 */
ReadStream.Buffer = function ReadStreamBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', chunk => {
      chunks.push(chunk)
    })
    readable.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    readable.on('error', reject)
  })
}

module.exports = ReadStream

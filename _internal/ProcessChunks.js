const decodeWebSocketFrame = require('./decodeWebSocketFrame')
const sleep = require('./sleep')

/**
 * @name ProcessChunks
 *
 * @docs
 * ```coffeescript [specscript]
 * ProcessChunks(chunks Array<Buffer> {
 *   continuationPayloads: Array<Buffer>
 * }, websocket ServerWebSocket) -> 
 * ```
 */
function ProcessChunks(chunks, websocket) {
  return async function processChunks() {
    while (!this.closed && !websocket.closed) {

      if (chunks.length == 0) {
        await sleep(0)
        continue
      }

      // let chunk = chunks.shift()
      let chunk = chunks.shift()
      let decodeResult = decodeWebSocketFrame(chunk)
      while (decodeResult == null && chunks.length > 0) {
        chunk = Buffer.concat([chunk, chunks.shift()])
        decodeResult = decodeWebSocketFrame(chunk)
      }
      if (decodeResult == null) {
        // chunks.unshift(chunk)
        chunks.prepend(chunk)
        await sleep(0)
        continue
      }

      const { fin, opcode, payload, remaining, masked } = decodeResult

      // The server must close the connection upon receiving a frame that is not masked
      if (!masked) {
        websocket.sendClose()
        // websocket.close()
        break
      }

      if (remaining.length > 0) {
        // chunks.unshift(remaining)
        chunks.prepend(remaining)
      }

      if (opcode === 0x0) { // continuation frame
        chunks.continuationPayloads.push(payload)
        if (fin) { // last continuation frame
          websocket.emit('message', Buffer.concat(chunks.continuationPayloads))
          chunks.continuationPayloads = []
        }
      } else if (fin) { // unfragmented message

        switch (opcode) {
          case 0x0: // continuation frame
            chunks.continuationPayloads.push(payload)
            websocket.emit('message', Buffer.concat(chunks.continuationPayloads))
            chunks.continuationPayloads = []
            break
          case 0x1: // text frame
          case 0x2: // binary frame
            websocket.emit('message', payload)
            break
          case 0x3: // non-control frame
          case 0x4: // non-control frame
          case 0x5: // non-control frame
          case 0x6: // non-control frame
          case 0x7: // non-control frame
            break
          case 0x8: // close frame
            if (websocket.sentClose) {
              websocket.destroy()
            } else {
              websocket.sendClose()
              websocket.destroy()
            }
            break
          case 0x9: // ping frame
            websocket.emit('ping', payload)
            websocket.sendPong(payload)
            break
          case 0xA: // pong frame
            websocket.emit('pong', payload)
            break
          case 0xB: // control frame
          case 0xC: // control frame
          case 0xD: // control frame
          case 0xE: // control frame
          case 0xF: // control frame
            break
        }

      } else { // fragmented message, wait for continuation frames
        chunks.continuationPayloads.push(payload)
      }

      await sleep(0)
    }
  }

}

module.exports = ProcessChunks

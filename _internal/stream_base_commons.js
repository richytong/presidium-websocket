const net = require('net')

const socket = new net.Socket()

let kBuffer
let kBufferCb

for (const sym of Object.getOwnPropertySymbols(socket)) {
  const s = sym.toString()
  if (s == 'Symbol(kBuffer)') {
    kBuffer = sym
  } else if (s == 'Symbol(kBufferCb)') {
    kBufferCb = sym
  }
}

module.exports = {
  kBuffer,
  kBufferCb
}

const OPCODES = require('./OPCODES')
const encodeFrame = require('./encodeFrame')

function processMessage(socket, opcode, payload) {
  if (opcode === OPCODES.TEXT) {
    const text = payload.toString();
    // Echo back
    socket.write(encodeFrame(text));
  } else if (opcode === OPCODES.BINARY) {
    // Echo binary back
    socket.write(encodeFrame(payload, OPCODES.BINARY));
  }
}

module.exports = processMessage

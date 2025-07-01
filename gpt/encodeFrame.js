const OPCODES = require('./OPCODES')

function encodeFrame(payload, opcode = OPCODES.TEXT, mask = false, fin = true) {
  if (!Buffer.isBuffer(payload)) {
    payload = Buffer.from(payload);
  }
  const payloadLen = payload.length;

  let header = [];

  const firstByte = (fin ? 0x80 : 0x00) | opcode;
  header.push(firstByte);

  let secondByte = mask ? 0x80 : 0x00;

  if (payloadLen < 126) {
    secondByte |= payloadLen;
    header.push(secondByte);
  } else if (payloadLen < 65536) {
    secondByte |= 126;
    header.push(secondByte);
    header.push((payloadLen >> 8) & 0xff);
    header.push(payloadLen & 0xff);
  } else {
    secondByte |= 127;
    header.push(secondByte);
    const lenBuffer = Buffer.alloc(8);
    lenBuffer.writeBigUInt64BE(BigInt(payloadLen), 0);
    header.push(...lenBuffer);
  }

  if (mask) {
    const maskKey = crypto.randomBytes(4);
    const maskedPayload = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
      maskedPayload[i] = payload[i] ^ maskKey[i % 4];
    }
    return Buffer.concat([Buffer.from(header), maskKey, maskedPayload]);
  } else {
    return Buffer.concat([Buffer.from(header), payload]);
  }
}

module.exports = encodeFrame

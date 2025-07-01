function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const fin = !!(firstByte & 0x80);
  const opcode = firstByte & 0x0f;

  const secondByte = buffer[1];
  const masked = !!(secondByte & 0x80);
  let payloadLen = secondByte & 0x7f;

  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLen = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buffer.length < offset + 8) return null;
    payloadLen = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLen) return null;

  let payload = buffer.slice(offset, offset + payloadLen);

  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  const remaining = buffer.slice(offset + payloadLen);

  return {
    frame: {
      fin,
      opcode,
      payload
    },
    remaining
  };
}

module.exports = decodeFrame

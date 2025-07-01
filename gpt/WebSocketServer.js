const net = require('net');
const crypto = require('crypto');

const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xA
};

const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebSocketServer {
  constructor({ port }) {
    this.server = net.createServer(this.handleConnection.bind(this));
    this.server.listen(port, () => {
      console.log(`WebSocket server running on port ${port}`);
    });
  }

  handleConnection(socket) {
    console.log('New TCP connection');

    let buffer = Buffer.alloc(0);
    let handshakeDone = false;

    let fragmentedMessage = null;
    let fragmentedOpcode = null;

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      if (!handshakeDone) {
        const result = this.tryParseHttpRequest(buffer);
        if (!result) return;

        const { headers, leftover } = result;
        buffer = leftover;

        if (!headers['sec-websocket-key']) {
          socket.end();
          return;
        }

        const acceptKey = this.generateAcceptKey(headers['sec-websocket-key']);
        const response = [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${acceptKey}`,
          '\r\n'
        ].join('\r\n');

        socket.write(response);
        handshakeDone = true;
        console.log('Handshake complete');
      }

      while (true) {
        const frameResult = this.decodeFrame(buffer);
        if (!frameResult) break;

        const { frame, remaining } = frameResult;
        buffer = remaining;

        if (frame.opcode === OPCODES.CONTINUATION) {
          if (!fragmentedMessage) {
            console.log('Unexpected continuation frame!');
            socket.destroy();
            return;
          }
          fragmentedMessage = Buffer.concat([fragmentedMessage, frame.payload]);
          if (frame.fin) {
            this.onMessage(socket, fragmentedOpcode, fragmentedMessage);
            fragmentedMessage = null;
            fragmentedOpcode = null;
          }
        } else if (frame.opcode === OPCODES.TEXT || frame.opcode === OPCODES.BINARY) {
          if (frame.fin) {
            this.onMessage(socket, frame.opcode, frame.payload);
          } else {
            fragmentedMessage = frame.payload;
            fragmentedOpcode = frame.opcode;
          }
        } else if (frame.opcode === OPCODES.PING) {
          socket.write(this.encodeFrame(frame.payload, OPCODES.PONG));
        } else if (frame.opcode === OPCODES.PONG) {
          console.log('PONG received');
        } else if (frame.opcode === OPCODES.CLOSE) {
          console.log('CLOSE received');
          socket.write(this.encodeFrame(frame.payload, OPCODES.CLOSE));
          socket.end();
        } else {
          console.log('Unknown opcode:', frame.opcode);
        }
      }
    });

    socket.on('end', () => {
      console.log('Connection closed');
    });
  }

  // Overridable
  onMessage(socket, opcode, payload) {
    if (opcode === OPCODES.TEXT) {
      const text = payload.toString();
      socket.write(this.encodeFrame(text, OPCODES.TEXT));
    } else if (opcode === OPCODES.BINARY) {
      socket.write(this.encodeFrame(payload, OPCODES.BINARY));
    }
  }

  tryParseHttpRequest(buffer) {
    const str = buffer.toString();
    const idx = str.indexOf('\r\n\r\n');
    if (idx === -1) return null;

    const headerPart = str.slice(0, idx);
    const lines = headerPart.split('\r\n');
    const headers = {};

    for (let i = 1; i < lines.length; i++) {
      const [key, ...rest] = lines[i].split(':');
      headers[key.trim().toLowerCase()] = rest.join(':').trim();
    }

    const leftover = buffer.slice(idx + 4);
    return { headers, leftover };
  }

  generateAcceptKey(secWebSocketKey) {
    return crypto
      .createHash('sha1')
      .update(secWebSocketKey + MAGIC_GUID)
      .digest('base64');
  }

  decodeFrame(buffer) {
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

  encodeFrame(payload, opcode = OPCODES.TEXT, mask = false, fin = true) {
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload);
    }
    const payloadLen = payload.length;

    const header = [];

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
}

module.exports = WebSocketServer;

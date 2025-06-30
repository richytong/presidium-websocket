const net = require('net');
const crypto = require('crypto');

const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xA
};

const server = net.createServer((socket) => {
  console.log('New TCP connection');

  let handshakeDone = false;
  let leftover = Buffer.alloc(0);
  let fragmentedMessage = null;
  let fragmentedOpcode = null;

  socket.on('data', (data) => {
    if (!handshakeDone) {
      performHandshake(socket, data);
      handshakeDone = true;
      return;
    }

    leftover = Buffer.concat([leftover, data]);

    while (true) {
      const result = decodeWebSocketFrame(leftover);
      if (!result) break;

      const { frame, remaining } = result;
      leftover = remaining;

      if (frame.opcode === OPCODES.CONTINUATION) {
        if (!fragmentedMessage) {
          console.error('Unexpected continuation frame!');
          socket.destroy();
          return;
        }
        fragmentedMessage = Buffer.concat([fragmentedMessage, frame.payload]);
        if (frame.fin) {
          echoCompleteMessage(socket, fragmentedOpcode, fragmentedMessage);
          fragmentedMessage = null;
          fragmentedOpcode = null;
        }
      } else if (frame.opcode === OPCODES.TEXT || frame.opcode === OPCODES.BINARY) {
        if (frame.fin) {
          echoCompleteMessage(socket, frame.opcode, frame.payload);
        } else {
          fragmentedMessage = frame.payload;
          fragmentedOpcode = frame.opcode;
        }
      } else if (frame.opcode === OPCODES.PING) {
        console.log('Received PING');
        const pongFrame = encodeWebSocketFrame(frame.payload, OPCODES.PONG);
        socket.write(pongFrame);
      } else if (frame.opcode === OPCODES.PONG) {
        console.log('Received PONG');
      } else if (frame.opcode === OPCODES.CLOSE) {
        console.log('Received CLOSE');
        // Echo close frame back
        const closeFrame = encodeWebSocketFrame(frame.payload, OPCODES.CLOSE);
        socket.write(closeFrame);
        socket.end();
      } else {
        console.log('Unknown opcode:', frame.opcode);
      }
    }
  });

  socket.on('end', () => {
    console.log('Connection closed');
  });
});

server.listen(8080, () => {
  console.log('WebSocket server running on port 8080');
});

function echoCompleteMessage(socket, opcode, payload) {
  if (opcode === OPCODES.TEXT) {
    const text = payload.toString();
    console.log('Text message received:', text);
    // Echo back
    socket.write(encodeWebSocketFrame(`Echo: ${text}`));
  } else if (opcode === OPCODES.BINARY) {
    console.log('Binary message received (length =', payload.length, ')');
    // Echo back binary data unchanged
    socket.write(encodeWebSocketFrame(payload, OPCODES.BINARY));
  }
}



const net = require('net');
const crypto = require('crypto');
const generateAcceptKey = require('./generateAcceptKey')
const tryParseHttpRequest = require('./tryParseHttpRequest')
const decodeFrame = require('./decodeFrame')
const encodeFrame = require('./encodeFrame')
const OPCODES = require('./OPCODES')

const server = net.createServer((socket) => {
  console.log('New TCP connection');

  let handshakeDone = false;
  let buffer = Buffer.alloc(0);

  let fragmentedMessage = null;
  let fragmentedOpcode = null;

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    if (!handshakeDone) {
      const result = tryParseHttpRequest(buffer);
      if (!result) return;

      const { headers, leftover } = result;
      buffer = leftover;

      if (!headers['sec-websocket-key']) {
        socket.end();
        return;
      }

      const acceptKey = generateAcceptKey(headers['sec-websocket-key']);
      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${acceptKey}`,
          '\r\n'
        ].join('\r\n')
      );

      handshakeDone = true;
      console.log('Handshake complete');
    }

    while (true) {
      const frameResult = decodeFrame(buffer);
      if (!frameResult) break;

      const { frame, remaining } = frameResult;
      buffer = remaining;

      if (frame.opcode === OPCODES.CONTINUATION) {
        if (!fragmentedMessage) {
          console.log('Unexpected continuation');
          socket.destroy();
          return;
        }
        fragmentedMessage = Buffer.concat([fragmentedMessage, frame.payload]);
        if (frame.fin) {
          processMessage(socket, fragmentedOpcode, fragmentedMessage);
          fragmentedMessage = null;
          fragmentedOpcode = null;
        }
      } else if (frame.opcode === OPCODES.TEXT || frame.opcode === OPCODES.BINARY) {
        if (frame.fin) {
          processMessage(socket, frame.opcode, frame.payload);
        } else {
          fragmentedMessage = frame.payload;
          fragmentedOpcode = frame.opcode;
        }
      } else if (frame.opcode === OPCODES.PING) {
        console.log('PING received');
        socket.write(encodeFrame(frame.payload, OPCODES.PONG, false));
      } else if (frame.opcode === OPCODES.PONG) {
        console.log('PONG received');
      } else if (frame.opcode === OPCODES.CLOSE) {
        console.log('CLOSE received');
        socket.write(encodeFrame(frame.payload, OPCODES.CLOSE, false));
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

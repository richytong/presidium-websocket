const net = require("net");
const crypto = require("crypto");

class WebSocketClient {
  constructor({ host, port = 80, path = "/" }) {
    this.host = host;
    this.port = port;
    this.path = path;

    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connected = false;
    this.onMessage = () => {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, this.host, () => {
        const key = crypto.randomBytes(16).toString("base64");

        const request =
          `GET ${this.path} HTTP/1.1\r\n` +
          `Host: ${this.host}:${this.port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `\r\n`;

        this.socket.write(request);
      });

      this.socket.once("data", (data) => {
        const response = data.toString();
        if (response.includes("101 Switching Protocols")) {
          this.connected = true;

          // handle leftover data after headers
          const i = response.indexOf("\r\n\r\n");
          const rest = data.slice(i + 4);
          if (rest.length > 0) {
            this.buffer = Buffer.concat([this.buffer, rest]);
            this.processBuffer();
          }

          this.socket.on("data", (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            this.processBuffer();
          });

          resolve();
        } else {
          reject(new Error("WebSocket handshake failed:\n" + response));
        }
      });

      this.socket.on("error", reject);
      this.socket.on("close", () => {
        console.log("Socket closed.");
      });
    });
  }

  send(message) {
    const isText = typeof message === "string";
    const payload = isText ? Buffer.from(message, "utf8") : Buffer.from(message);
    const payloadLen = payload.length;

    let header;
    if (payloadLen < 126) {
      header = Buffer.alloc(2);
      header[1] = payloadLen | 0x80;
    } else if (payloadLen < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126 | 0x80;
      header.writeUInt16BE(payloadLen, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127 | 0x80;
      header.writeBigUInt64BE(BigInt(payloadLen), 2);
    }

    header[0] = 0x81; // FIN + text opcode

    const maskKey = crypto.randomBytes(4);
    const maskedPayload = Buffer.alloc(payloadLen);

    for (let i = 0; i < payloadLen; i++) {
      maskedPayload[i] = payload[i] ^ maskKey[i % 4];
    }

    const frame = Buffer.concat([header, maskKey, maskedPayload]);
    this.socket.write(frame);
  }

  processBuffer() {
    while (this.buffer.length >= 2) {
      const b1 = this.buffer[0];
      const b2 = this.buffer[1];

      const fin = (b1 & 0x80) !== 0;
      const opcode = b1 & 0x0f;

      let offset = 2;
      let payloadLen = b2 & 0x7f;

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      const isMasked = (b2 & 0x80) !== 0;
      if (isMasked) {
        if (this.buffer.length < offset + 4) return;
      }
      const maskKey = isMasked
        ? this.buffer.slice(offset, offset + 4)
        : null;
      if (isMasked) offset += 4;

      if (this.buffer.length < offset + payloadLen) return;

      let payload = this.buffer.slice(offset, offset + payloadLen);
      if (isMasked) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      this.buffer = this.buffer.slice(offset + payloadLen);

      if (opcode === 0x1) {
        // text frame
        this.onMessage(payload.toString("utf8"));
      } else if (opcode === 0x2) {
        // binary frame
        this.onMessage(payload);
      } else if (opcode === 0x8) {
        // close
        this.socket.end();
      } else if (opcode === 0x9) {
        // ping → pong
        this.sendPong(payload);
      } else if (opcode === 0xA) {
        // pong
      } else {
        // ignore other opcodes
      }
    }
  }

  sendPong(payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x8A; // FIN + pong
    const frame = Buffer.concat([header, payload]);
    this.socket.write(frame);
  }

  close() {
    const frame = Buffer.from([0x88, 0x00]);
    this.socket.write(frame);
    this.socket.end();
  }
}

module.exports = WebSocket

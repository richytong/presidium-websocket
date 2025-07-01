const crypto = require('crypto')

const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function generateAcceptKey(secWebSocketKey) {
  return crypto
    .createHash('sha1')
    .update(secWebSocketKey + MAGIC_GUID)
    .digest('base64');
}

module.exports = generateAcceptKey

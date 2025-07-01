function tryParseHttpRequest(buffer) {
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

module.exports = tryParseHttpRequest

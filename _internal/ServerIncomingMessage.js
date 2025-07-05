const http = require('http')

class ServerIncomingMessage extends http.IncomingMessage {
  constructor() {
    super()
  }
}

const incomingMessage = new ServerIncomingMessage()
console.log(incomingMessage)

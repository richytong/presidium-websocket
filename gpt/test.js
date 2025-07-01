const assert = require('assert')
const Http = require('presidium/Http')
const net = require('net')
const http = require('http')
const sleep = require('../_internal/sleep')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('./WebSocket')

describe('WebSocketServer, WebSocket', () => {
  it('Minimal WebSocketServer and WebSocket text exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocketServer(websocket => {
      websocket.on('message', message => {
        assert.equal(server.clients.size, 1)
        messages.push(message)
        websocket.send('pong')
      })

      websocket.on('close', () => {
        server.close()
      })
    })

    server.server.on('close', () => {
      resolve()
    })

    server.server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send('ping')
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].toString('utf8'), 'ping')
    assert.equal(messages[1].toString('utf8'), 'pong')
    server.close()

    await sleep(100)
  }).timeout(5000)

  it('Minimal WebSocketServer and WebSocket buffer exchange', async () => {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocketServer(websocket => {
      websocket.on('message', message => {
        assert.equal(server.clients.size, 1)
        messages.push(message)
        websocket.send(Buffer.from('pong'))
      })

      websocket.on('close', () => {
        server.close()
      })
    })

    server.on('request', () => {
      didRequest = true
    })

    server.on('upgrade', () => {
      didUpgrade = true
    })

    server.on('close', () => {
      resolve()
    })

    server.listen(7357)

    const websocket = new WebSocket('ws://localhost:7357')

    websocket.on('message', message => {
      messages.push(message)
      websocket.close()
    })

    websocket.on('open', () => {
      websocket.send(Buffer.from('ping'))
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert(Buffer.isBuffer(messages[0]))
    assert(Buffer.isBuffer(messages[1]))
    assert.equal(messages[0].toString('utf8'), 'ping')
    assert.equal(messages[1].toString('utf8'), 'pong')
    server.close()

    await sleep(100)
  }).timeout(5000)

})

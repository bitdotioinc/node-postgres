'use strict'
var buffers = require('../../test-buffers')
var helper = require('./test-helper')
var suite = new helper.Suite()

const { WebSocketServer } = require('ws')

var Server = function (response) {
  this.server = undefined
  this.socket = undefined
  this.response = response
}

let port = 54321
Server.prototype.start = function (cb) {
  // this is our fake postgres server
  // it responds with our specified response immediatley after receiving every buffer
  // this is sufficient into convincing the client its connectet to a valid backend
  // if we respond with a readyForQuery message

  port = port + 1

  this.server = new WebSocketServer({port: port})
  this.server.on('connection', function (socket) {
    this.socket = socket
    if (this.response) {
      this.socket.on(
        'message',
        function (data) {
          // deny request for SSL
          if (data.length == 8) {
            this.socket.send(Buffer.from('N', 'utf8'))
            // consider all authentication requests as good
          } else if (!data[0]) {
            this.socket.send(buffers.authenticationOk())
            // respond with our canned response
          } else {
            this.socket.send(this.response)
          }
        }.bind(this)
      )
    }
  }.bind(this))

  var options = {
    host: 'localhost',
    port: port,
  }
  this.server.on('listening', function () {
    cb(options)
  })
}

Server.prototype.drop = function () {
  this.socket.terminate()
}

Server.prototype.close = function (cb) {
  this.server.close(cb)
}

var testServer = function (server, cb) {
  // wait for our server to start
  server.start(function (options) {
    // connect a client to it
    var client = new helper.Client(options)
    client.connect().catch((err) => {
      assert(err instanceof Error)
      clearTimeout(timeoutId)
      server.close(cb)
    })

    server.server.on('connection', () => {
      // after 50 milliseconds, drop the client
      setTimeout(function () {
        server.drop()
      }, 50)
    })

    // blow up if we don't receive an error
    var timeoutId = setTimeout(function () {
      throw new Error('Client should have emitted an error but it did not.')
    }, 5000)
  })
}

suite.test('readyForQuery server', (done) => {
  const respondingServer = new Server(buffers.readyForQuery())
  testServer(respondingServer, done)
})

suite.test('silent server', (done) => {
  const silentServer = new Server()
  testServer(silentServer, done)
})

'use strict'
var net = require('net')
var helper = require('../test-helper')
var Connection = require('../../../lib/connection')
var utils = require('../../../lib/utils')
const WebSocketStream = require('websocket-stream')
var connect = function (callback) {
  var username = helper.args.user
  var database = helper.args.database
  // var con = new Connection({ stream: new net.Stream() })
  var con = new Connection({stream: new WebSocketStream('ws://localhost:5432')})
  con.on('error', function (error) {
    console.log(error)
    throw new Error('Connection error')
  })
  con.connect(helper.args.port || '5432', helper.args.host || 'localhost')
  con.once('connect', function () {
    con.startup({
      user: username,
      database: database,
    })
    con.once('authenticationCleartextPassword', function () {
      con.password(helper.args.password)
    })
    con.once('authenticationMD5Password', function (msg) {
      con.password(utils.postgresMd5PasswordHash(helper.args.user, helper.args.password, msg.salt))
    })
    con.once('readyForQuery', function () {
      con.query('create temp table ids(id integer)')
      con.once('readyForQuery', function () {
        con.query('insert into ids(id) values(1); insert into ids(id) values(2);')
        con.once('readyForQuery', function () {
          callback(con)
        })
      })
    })
  })
}

module.exports = {
  connect: connect,
}

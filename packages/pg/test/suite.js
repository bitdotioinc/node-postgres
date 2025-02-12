'use strict'

const async = require('async')

class Test {
  constructor(name, cb) {
    this.name = name
    this.action = cb
    // timeout set higher since 1105-tests.js takes around 9000 ms to pass with websockets
    this.timeout = 10000
  }

  run(cb) {
    try {
      this._run(cb)
    } catch (e) {
      cb(e)
    }
  }

  _run(cb) {
    if (!this.action) {
      console.log(`${this.name} skipped`)
      return cb()
    }
    if (!this.action.length) {
      const result = this.action.call(this)
      if (!(result || 0).then) {
        return cb()
      }
      result.then(() => cb()).catch((err) => cb(err || new Error('Unhandled promise rejection')))
    } else {
      this.action.call(this, cb)
    }
  }
}

class Suite {
  constructor(name) {
    console.log('')
    this._queue = async.queue(this.run.bind(this), 1)
    this._queue.drain = () => {}
  }

  run(test, cb) {
    process.stdout.write('  ' + test.name + ' ')
    if (!test.action) {
      process.stdout.write('? - SKIPPED\n')
      return cb()
    }

    const tid = setTimeout(() => {
      const err = Error(`test: ${test.name} did not complete withint ${test.timeout}ms`)
      console.log('\n' + err.stack)
      process.exit(-1)
    }, test.timeout)

    test.run((err) => {
      clearTimeout(tid)
      if (err) {
        process.stdout.write(`FAILED!\n\n${err.stack}\n`)
        process.exit(-1)
      } else {
        process.stdout.write('✔\n')
        cb()
      }
    })
  }

  test(name, cb) {
    const test = new Test(name, cb)
    this._queue.push(test)
  }

  /**
   * Run an async test that can return a Promise. If the Promise resolves
   * successfully then the test will pass. If the Promise rejects with an
   * error then the test will be considered failed.
   */
  testAsync(name, action) {
    const test = new Test(name, (cb) => {
      Promise.resolve()
        .then(action)
        .then(() => cb(null), cb)
    })
    this._queue.push(test)
  }
}

process.on('unhandledRejection', (e) => {
  setImmediate(() => {
    console.error('Unhandled promise rejection')
    throw e
  })
})

module.exports = Suite

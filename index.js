var through = require('through')
  , min = require('./min.js')

module.exports = objectify

function objectify(find) {
  var stream = through(write, end)
    , inner = min(find)(read)
    , ended = false
    , accum = []
    , cb

  iter()

  return stream

  function iter() {
    inner(null, function(err, data) {
      if(err) {
        stream.emit('error', err)
        return
      }
      if(data === undefined) {
        stream.queue(null)
        return
      }
      stream.queue(data)
      iter()
    })
  }

  function write(buf) {
    accum.push(buf)
    if(!cb) {
      return
    }

    while(accum.length) {
      cb(null, accum.shift())
    }
  }

  function end() {
    ended = true
    console.log('ended')
    if(cb) cb()
  }

  function read(close, callback) {
    if(close) {
      if(close === true) { 
        stream.queue(null)
      } else {
        stream.emit('error', close)
      }
      return
    }

    if(ended) {
      return callback()
    }

    cb = callback
  }
}

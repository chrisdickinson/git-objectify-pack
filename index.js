var through = require('through')
  , hashify = require('git-object-hash')
  , apply = require('git-apply-delta')
  , g2j = require('git-to-js')
  , binary = require('bops')

module.exports = objectify

var OFS_DELTA = 6
  , REF_DELTA = 7

function objectify(find) {
  var stream = through(write, end)
    , loaded = []
    , pending = 0
    , ended = false

  stream.setMaxListeners(Infinity)

  return stream

  function write(info) {
    if(info.type === REF_DELTA) {
      return object_from_ref_delta(info)
    }

    if(info.type === OFS_DELTA) {
      return object_from_ofs_delta(info)
    }

    var out = {
        offset: info.offset
      , object: g2j(info.type, info.data)
      , hash: null
    }
    out.object.hash = out.hash = hashify(out.object)
    stream.queue(out.object)
  }

  function end() {
    ended = true
    if(!pending) {
      really_end()
    }
  }

  function really_end() {
    if(!ended) {
      return
    }
    loaded = null
    stream.queue(null)
  }

  function object_from_ofs_delta(info) {
    // walk back from loaded.length to 0
    var buf = info.reference
      , _byte = buf[0]
      , offset = _byte & 0x7F

    while(_byte & 0x80) {
      offset += 1
      offset <<= 7
      _byte = buf[idx++]
      offset += _byte & 0x7F
    }

    for(var i = loaded.length - 1; i > -1; --i) {
      var target = loaded[i]
      if(target.offset === offset) {
        break
      } 
    }

    if(i === -1) {
      stream.emit('error', new Error('could not find object at offset: '+offset))
      return
    }

    apply_delta(info, target.object)
  }

  function object_from_ref_delta(info) {
    var hash = binary.to(info.reference, 'hex')
      , found = false

    for(var i = loaded.length - 1; i > -1; --i) {
      var target = loaded[i]
      if(target.hash === hash) {
        break
      } 
    }

    if(i === -1) {
      ++pending
      var listener = function(data) {
        if(data.hash === hash) {
          delayed_find(data)
        }
      }
      stream.once('data', listener)
      return find(info.reference, function(err, data) {
        if(found) {
          return
        }
        stream.removeListener('data', listener)
        if(data) {
          delayed_find(data) 
        }
      })
    }

    return apply_delta(info, target.object)

    function delayed_find(data) {
      found = true
      info.type = data.type

      apply_delta(info, data)
      !--pending && really_end()
    }
  }

  function apply_delta(info, target) {
    var new_data = apply(info.data, target.serialize())
      , out = {}

    var out = {
        offset: info.offset
      , object: g2j(target.type, new_data)
      , hash: null
    }

    out.object.hash = out.hash = hashify(out.object)
    stream.queue(out.object)
  }
}

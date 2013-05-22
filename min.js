var hashify = require('git-object-hash')
  , apply = require('git-apply-delta')
  , g2j = require('git-to-js')
  , binary = require('bops')

module.exports = objectify

var OFS_DELTA = 6
  , REF_DELTA = 7

function objectify(find) {
  var waiting = {} 
    , traced = []
    , emit

  var offset_listeners = []
    , offset_to_ref = []
    , pending = 0
    , ended = false

  return function inner_objectify(read) {
    return function(close, _emit) {
      emit = _emit
      if(close) {
        traced =
        offset_listeners =
        offset_to_ref =
        waiting = null
        return close === true ? emit() : emit(err)
      }

      read(null, onread)
    }
  }

  function onread(err, info) {
    if(err) {
      return emit(err)
    }

    if(!info) {
      ended = true
      if(!pending) emit()
      return
    }

    if(info.type === REF_DELTA) {
      return object_from_ref_delta(info)
    }

    if(info.type === OFS_DELTA) {
      return object_from_ofs_delta(info)
    }

    var object = g2j(info.type, info.data)
    object.hash = hashify(object)
    do_emit(object, info.offset)
  }

  function object_from_ofs_delta(info) {
    var buf = info.reference
      , _byte = buf[0]
      , offset = _byte & 0x7F
      , idx = 1 
      , ref

    ++pending
    while(_byte & 0x80) {
      offset += 1
      offset <<= 7
      _byte = buf[idx++]
      offset += _byte & 0x7F
    }

    offset = info.offset - offset
    ref = offset_to_ref[offset]

    if(ref) {
      return find(ref, function(err, obj) {
        resolve_delta(err, info, obj)
      })
    }
    
    var listener = offset_listeners[offset] = offset_listeners[offset] || []
    listener[listener.length] = info
  }

  function object_from_ref_delta(info) {
    var hash = binary.to(info.reference, 'hex')
      , idx = add_wait(hash, info)

    ++pending
    if(has_emitted(hash)) {
      return find(hash, function(err, obj) {
        if(!obj) return

        if(waiting[hash]) {
          waiting[hash].splice(waiting[hash].indexOf(info), 1)
        }
        resolve_delta(err, info, obj)
      })
    }
  }

  function resolve_delta(err, info, object) {
    var new_data = apply(info.data, object.serialize())
      , new_object = g2j(object.type, new_data)

    new_object.hash = hashify(new_object)
    do_emit(new_object, info.offset)

    --pending
    if(ended) {
      emit()
    }
  }

  function has_emitted(hash) {
    return hash in waiting
  }

  function add_wait(hash, info) {
    waiting[hash] = waiting[hash] || []
    waiting[hash].push(info)
    return waiting[hash].length - 1
  }

  function do_emit(obj, offset) {
    var waiting_list = waiting[obj.hash]

    if(waiting_list) while(waiting_list.length) {
      resolve_delta(null, waiting_list.shift(), obj)
    }

    // make sure we pick up any ofs delta listeners as well.
    var at_offset = offset_listeners[offset]
    if(at_offset) while(at_offset.length) {
      resolve_delta(null, at_offset.shift(), obj)
    }
    offset_to_ref[offset] = obj.hash
    emit(null, obj)
  }
}

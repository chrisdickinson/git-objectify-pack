# git-objectify-pack

transform metadata objects emitted from [git-list-pack](http://npm.im/git-list-pack) into full-on git objects.

```javascript

var fs = require('fs')
  , list = require('git-list-pack')
  , objectify = require('git-objectify-pack')

fs.createReadStream('path/to/packfile')
  .pipe(list())
  .pipe(objectify(find))

function find(oid, ready) {
  // for finding ref-delta objects that might
  // be outside of the current packfile
  return ready(null, referencedObject | null)
}

```

## API

#### objectify(find) -> r/w stream of objects.

Create a r/w stream suitable for piping `git-list-pack` streams into.

Emits [git objects](http://npm.im/git-to-js) with attached string hashes.

## License

MIT

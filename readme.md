# stream-to-iterator

Converts a node.js stream into an iterator.

## Usage

```javascript
const streamToIterator = require('stream-to-iterator')
const pSeries = require('p-map-series')

//let readable = ...
let allValuesPromise = streamToIterator(readable, opts)
  .then(iterator =>
    pSeries(iterator, processIterationValue)
  )

allValuesPromise.then(allValues => {
  console.log(allValues)
})

function processIterationValue(value) {
  // ...
}
```

With [async functions](https://tc39.github.io/ecmascript-asyncawait/):

```javascript
const streamToIterator = require('stream-to-iterator')

//let readable = ...
let iterator = await streamToIterator(readable, opts)
let allValues = []

for (let valuePromise of iterator) {
  allValues.push(processIterationValue(await valuePromise))
}

console.log(allValues)

function processIterationValue(value) {
  // ...
}
```

## API

### streamToIterator(readable, opts)

Creates an iterator object wrapping the specified readable stream. As objects are requested from the iterator, an underlying writable stream is queried for new chunks, essentially draining chunks from the readable stream.

Items in the iterator are returned out-of-phase with the source readable stream; this is because of the `done` requirement of the iterator interface.

The outermost promise reads the stream to check if it's empty. The consumer can begin reading values from the iterator as soon as the outermost promise is resolved. As the consumer consumes iterations out of the iterator:
* The iteration value returned will be of type `Promise<T>`. To get the iteration value, the consumer must wait for the resolution of that promised value.
* The consumer **must not** prematurely get the next value of the iterator (i.e. call `Iterator#next()`) until such time that the current promise value of the iterator is resolved.

The underlying writable stream defaults to object mode. This is because the object converted into (the iterator) does not really need to be in a specific object or non-object mode.

For convenience, the iterator also implements the `Iterable` interface. Be careful though: this only reflects the current state of the iterator.

Parameters:
* `readable: Readable<T>` - A node.js-style readable stream. Streams v1-3 are supported (via node core `Readable.wrap()`).
* `opts: Object` - Options to pass to the underlying writable stream. Default: `{ objectMode: true }`. No merging is performed.

Returns: `Promise<Iterator<Promise<T>>>`

Errors:
* The iterator throws with:
  * `Error`
    1. If the iterator was called before the first chunk was received.
    2. If the iterator was called before the next chunk on the stream has been read.
* The iterator will also rethrow any error emitted by the source stream on the next iteration read from it after the error is handled.

<small>Nasty secret: the _underlying stream_ and the _iterator_ are the same thing!</small>

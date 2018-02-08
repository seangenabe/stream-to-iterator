# stream-to-iterator

Converts a node.js stream into an iterator.

## Usage

With _for-await-of_:

```javascript
const streamToIterator = require('stream-to-iterator')

//const readable = ...
const iterator = streamToIterator(readable, opts)
const allValues = []

for await (let value of iterator) {
  allValues.push(processIterationValue(value))
}

console.log(allValues)

function processIterationValue(value) {
  // ...
}
```

## API

### streamToIterator(readable, opts)

Creates a writable stream that is also an async iterator and pipes the readable stream to it. Chunks are drained from the source stream as objects are requested from the iterator.

Requested values are fulfilled serially. Requesting a value (`AsyncIterator#next`) from the iterator without waiting for a previous request to finish will result to the resolved value being equal to the resolved value of the previous request.

The underlying writable stream defaults to object mode. This is because the object converted into (the iterator) does not really need to be in a specific object or non-object mode.

For convenience, the iterator also implements the `AsyncIterable` interface. Be careful though: this only reflects the current state of the iterator.

The iterator will rethrow any error emitted on the stream on the next iteration read from it after the error is handled.

Parameters:
* `readable: Readable<T>` - A node.js-style readable stream. Streams v1-3 are supported (via node core `Readable.wrap()`).
* `opts: Object` - Options to pass to the underlying writable stream. Default: `{ objectMode: true }`. No merging is performed.

Returns: `AsyncIterator<T>`

## Migrating from v2

The old mode implementing `Iterator<Promise<T>>` is _still supported_. However, there are a few breaking changes:
* `streamToIterator` does not return a `Promise` anymore.
* To get an instance of the iterator, call `[Symbol.iterator]()` on the return value.
* Call `await init()` on the returned iterator to initialize it. This is the equivalent of calling the removed `Promise` interface on the original function.
* As with the new API, calling `Iterator#next` before waiting for the promise to finish will return the same value as the previous iteration.

```javascript
const iterator = await streamToIterator(readable).init()
for (let valuePromise of iterator) {
  const value = await valuePromise
  // do something with value
}
```

(See also the example on the tests.)

The old consumption rules still apply:

* The iteration value returned will be of type `Promise<T>`. To get the iteration value, the consumer must wait for the resolution of that promised value.
* The consumer **must not** prematurely get the next value of the iterator (i.e. call Iterator#next()) until such time that the current promise value of the iterator is resolved.

The iterator throws if the iterator was called before the first chunk was received.

## See also

* [async-iter-stream](https://github.com/calvinmetcalf/async-iter-stream) - similar module

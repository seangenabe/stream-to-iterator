const { Writable } = require('stream')
const Box = require('./box')
const nodeify = require('nodeify')

const EOS = Symbol('EOS')

module.exports = class IteratorWritable extends Writable {

  constructor(opts) {
    super(opts)
    this.writeAsync = async () => {
      let err = new Error("Must call run() first.")
      this.emit('error', err)
      throw err
    }
    this.endRequest = () =>
      this.emit('error', new Error("Must call run() first."))
    this.waitFirstChunk = new Box()
    this.run()
  }

  async run() {
    try {
      // Make sure the stream has any item first.
      this.next = () => {
        throw new Error("Cannot request for an iteration yet.")
      }

      // Read first chunk.
      let chunk = await this.readChunkFromStream()
      let waitNextIteration = new Box() // dummy
      if (chunk !== EOS) {
        let previousChunk = chunk
        // Prepare stream to wait for the next chunk.
        let streamWaitNext = new Box()

        // Loop condition: Tell if the previous signal was the end of the
        // stream + receive a chunk from the stream
        let readChunk = async() => {
          if (previousChunk === EOS) {
            return false
          }
          chunk = await this.readChunkFromStream(streamWaitNext)
          return true
        }
        while (await readChunk()) {
          // Okay to send previous iteration.
          // (For the (n > 1)th iteration--this is handled by the dummy
          // so we don't have to check.)
          waitNextIteration.push(true)
          // Wait for next iteration.
          waitNextIteration = new Box()
          // Send previous chunk.
          await
            this.sendChunkToIterator(previousChunk, waitNextIteration)
          // Okay to send previous chunk to iterator.
          // Okay to write next chunk.
          streamWaitNext.push(true)

          previousChunk = chunk
        }
        // Send remaining chunk.
        waitNextIteration.push(true)
        this.sendChunkToIterator(chunk) // Nothing to wait for, let's go!
      }

      // End iterator
      waitNextIteration.push(true)
      this.sendChunkToIterator(EOS) // Also nothing to wait for here.
    }
    catch (err) {
      this.emit('error', err)
    }
  }

  // Wait for the iterator to receive a chunk.
  sendChunkToIterator(chunk, waitNext = Promise.resolve()) {
    return new Promise(resolve => {
      this.next = () => {
        this.next = () => {
          throw new Error(
            "Must wait for the current iteration value to resolve."
          )
        }
        let done = chunk === EOS
        let v = done ? undefined : chunk
        return {
          done,
          value: (async() => {
            // Signal that the chunk has been received.
            resolve()
            // Wait for the next chunk to be sent.
            await waitNext
            // Return the value already sent.
            return v
          })()
        }
      }
      // Signal that chunks can be read from the iterator.
      // Rely on Promise#resolve reentry prevention to ensure this only happens
      // once. :)
      this.waitFirstChunk.push(true)
    })
  }

  // Read a chunk from the stream.
  readChunkFromStream(waitNext = Promise.resolve()) {
    return new Promise((resolve, reject) => {
      let h1
      // Handler called when the promise is resolved or rejected.
      let precomplete = () => {
        // Remove event listeners.
        this.removeListener('error', h1)
      }
      // enc is significant here (argument counting)
      // eslint-disable-next-line no-unused-vars
      this.writeAsync = async(chunk, enc) => {
        precomplete()
        // Receive a chunk from the stream.
        resolve(chunk)
        // Wait until the chunk has been consumed.
        await waitNext
      }
      // Synchronous method called when the stream has been ended.
      this.endRequest = () => {
        precomplete()
        // Represent the end of the stream with a symbol EOS.
        // Resolve this special symbol.
        resolve(EOS)
      }
      h1 = () => {
        precomplete()
        // Handle stream errors with a promise rejection here.
        reject()
      }
      this.once('error', h1)
    })
  }

  _write(chunk, enc, cb) {
    nodeify(this.writeAsync(chunk, enc), cb)
  }

  end(chunk, enc, cb) {
    super.end(chunk, enc, (err) => {
      if (err) {
        cb(err)
        return
      }
      nodeify(this.endRequest(), cb)
    })
  }

  // Support the iterable interface for convenience.
  [Symbol.iterator]() {
    return this
  }

}

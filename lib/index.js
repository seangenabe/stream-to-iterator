const IteratorWritable = require('./iterator-writable')

async function streamToIterator(readable, opts) {
  if (!opts) {
    opts = {
      objectMode: true // default to object mode if opts is not defined
    }
  }
  let writable = new IteratorWritable(opts)
  readable.pipe(writable)
  readable.on('error', err => {
    writable.emit('error', err)
  })
  await writable.waitFirstChunk
  return writable
}

module.exports = streamToIterator

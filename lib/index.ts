import IteratorWritable = require('./iterator-writable')
import { Readable } from 'stream'
import pump = require('pump')

function streamToIterator<T = any>(
  readable: Readable,
  opts: { objectMode?: boolean } = { objectMode: true }
) {
  readable = new Readable({ objectMode: true }).wrap(readable)

  let writable = new IteratorWritable<T>(opts)
  pump(readable, writable)
  return writable
}

export = streamToIterator

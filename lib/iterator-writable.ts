import { Writable, WritableOptions } from 'stream'
import pDefer = require('p-defer')
import Initializable = require('./initializable')
//import { debuglog } from 'util'

//const log = debuglog('s2i')
const log = console.log
const EOS = Symbol('EOS')
const UNINITIALIZED = Symbol('UNINITIALIZED')
const ASYNC_ITERATOR_NOT_FOUND = Symbol()

enum State {
  Main,
  Finished
}

class IteratorWritable<T> extends Writable implements AsyncIterableIterator<T> {
  private state: State
  private writeBox: Deferred<T | symbol>
  private previousValue: T | symbol
  private iteratorConsumed: Deferred<true | symbol>
  private err: Error

  constructor(opts?: WritableOptions) {
    super(opts)
    log('constructor')
    this.end = this.end2.bind(this)
    this.previousValue = UNINITIALIZED
    this.state = State.Main
    this.run()
  }

  async run() {
    this.once('error', err => {
      this.state = State.Finished
      this.err = err
    })
    while (this.state !== State.Finished) {
      log(`state transition: ${State[this.state]}`)

      this.writeBox = pDefer()
      this.iteratorConsumed = pDefer()
      this.previousValue = await this.writeBox.promise

      await this.iteratorConsumed.promise
      if (this.previousValue === EOS) {
        this.state = State.Finished
      }
      // else continue
    }
  }

  _write(chunk: any, encoding: string, callback: (err?: Error) => void): void {
    ;(async () => {
      try {
        await this.writeAsync(chunk, encoding)
        callback()
      } catch (err) {
        callback(err)
      }
    })()
  }

  async writeAsync(chunk: T, enc: string) {
    log(`write: ${chunk}`)
    if (this.state != State.Main) {
      throw new Error('Not ready for writing.')
    }
    this.writeBox.resolve(chunk)
  }

  endRequest() {
    log('end')
    if (this.state != State.Main) {
      throw new Error('Not ready for writing.')
    }
    this.writeBox.resolve(EOS)
  }

  private end2(chunk?: T, enc?: string, cb?: (err: Error) => void): void {
    super.end(chunk, enc, err => {
      if (cb && err) {
        cb(err)
        return
      }
      this.endRequest()
    })
  }

  async next(): Promise<IteratorResult<T>> {
    log('next')
    if (this.state === State.Finished) {
      const { err } = this
      if (err) {
        throw err
      }
      return { done: true } as IteratorResult<T>
    }
    this.iteratorConsumed.resolve(true)
    const val = await this.writeBox.promise
    log(`returning value to iterator`, val)
    if (val === EOS) {
      return { done: true } as IteratorResult<T>
    } else {
      return { done: false, value: val as T }
    }
  }

  async init(): Promise<this> {
    log('init')
    this.iteratorConsumed.resolve(true)
    this.previousValue = await this.writeBox.promise
    return this
  }

  legacyNext(): IteratorResult<Promise<T>> {
    log(`legacyNext`)
    if (this.state === State.Finished) {
      const { err } = this
      if (err) {
        throw err
      }
      return { done: true } as IteratorResult<Promise<T>>
    }
    const { previousValue } = this
    if (previousValue === UNINITIALIZED) {
      throw new Error('Must call init() first.')
    }
    if (previousValue === EOS) {
      return { done: true } as IteratorResult<Promise<T>>
    } else {
      return {
        done: false,
        value: (async (): Promise<T> => {
          this.iteratorConsumed.resolve(true)
          await this.writeBox.promise
          return previousValue as T
        })()
      }
    }
  }

  [Symbol.asyncIterator](): this
  [Symbol.asyncIterator || ASYNC_ITERATOR_NOT_FOUND](): this {
    return this
  }

  [Symbol.iterator](): IterableIterator<Promise<T>> & Initializable {
    const o: IterableIterator<Promise<T>> & Initializable = {
      init: async () => {
        await this.init()
        return o
      },
      next: () => this.legacyNext(),
      [Symbol.iterator]: () => o
    }
    return o
  }
}

export = IteratorWritable

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: any) => void
}

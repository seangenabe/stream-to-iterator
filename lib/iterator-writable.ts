import { Writable, WritableOptions } from 'stream'
import { callbackify } from 'util'
import pDefer = require('p-defer')
import Initializable = require('./initializable')

const EOS = Symbol('EOS')
const UNINITIALIZED = Symbol('UNINITIALIZED')
const ASYNC_ITERATOR_NOT_FOUND = Symbol()

enum State {
  PreWrite,
  WaitForWrite,
  WaitForIteratorConsume,
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
    this.state = State.PreWrite
    this.end = this.end2.bind(this)
    this.write = callbackify((chunk, enc) => this.writeAsync(chunk, enc)) as any
    this.previousValue = UNINITIALIZED
    this.run()
  }

  async run() {
    let writeBox: Deferred<T | symbol> = pDefer()
    writeBox.resolve(UNINITIALIZED)
    this.once('error', err => {
      this.state = State.Finished
      this.err = err
    })
    while (true) {
      switch (this.state) {
        case State.PreWrite: {
          writeBox = pDefer()
          this.state = State.WaitForWrite
          break
        }
        case State.WaitForWrite: {
          if (writeBox) {
            this.previousValue = await writeBox.promise
          }
          this.iteratorConsumed = pDefer()
          this.state = State.WaitForIteratorConsume
          break
        }
        case State.WaitForIteratorConsume: {
          await this.iteratorConsumed.promise
          if (writeBox && (await writeBox.promise) === EOS) {
            this.state = State.Finished
          } else {
            this.state = State.PreWrite
          }
          break
        }
      }
    }
  }

  async writeAsync(chunk: T, enc: string) {
    if (this.state != State.PreWrite) {
      throw new Error('Not ready for writing.')
    }
    this.writeBox.resolve(chunk)
  }

  endRequest() {
    if (this.state != State.PreWrite) {
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
    if (this.state === State.Finished) {
      const { err } = this
      if (err) {
        throw err
      }
      return { done: true } as IteratorResult<T>
    }
    const val = await this.writeBox.promise
    this.iteratorConsumed.resolve(true)
    if (val === EOS) {
      return { done: true } as IteratorResult<T>
    } else {
      return { done: false, value: val as T }
    }
  }

  async init(): Promise<this> {
    this.previousValue = await this.writeBox.promise
    this.iteratorConsumed.resolve(true)
    return this
  }

  legacyNext(): IteratorResult<Promise<T>> {
    if (this.state === State.Finished) {
      const { err } = this
      if (err) {
        throw err
      }
      return { done: true } as IteratorResult<Promise<T>>
    }
    if (this.state !== State.WaitForIteratorConsume) {
      throw new Error('Cannot request for an iteration yet.')
    }
    const { previousValue } = this
    if (previousValue === UNINITIALIZED) {
      throw new Error('Must call init() first.')
    }
    this.iteratorConsumed.resolve(true)
    if (previousValue === EOS) {
      return { done: true } as IteratorResult<Promise<T>>
    } else {
      return {
        done: false,
        value: (async (): Promise<T> => {
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

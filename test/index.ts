import test, { TestContext } from 'ava'
import streamToIterator = require('../lib/index')
import { PassThrough, TransformOptions } from 'stream'
import delay = require('delay')

test('empty stream (legacy)', async t => {
  let stream = createReadable({ objectMode: true }, [])
  let x = streamToIterator<never>(stream)[Symbol.iterator]()
  await x.init()
  let i = x.next()
  t.true(i.done)
})

test('empty stream', async t => {
  let stream = createReadable({ objectMode: true }, [])
  let x = await streamToIterator<never>(stream)
  await x.init()
  let i = await x.next()
  t.true(i.done)
})

test('stream one value (legacy)', async t => {
  let values = ['abc']
  let stream = createReadable({ objectMode: true }, values)
  let x = streamToIterator<string>(stream)[Symbol.iterator]()
  await x.init()
  for (let value of values) {
    let iteration = x.next()
    await checkLegacyIteration(t, iteration, value)
  }
  t.true(x.next().done)
})

test('stream one value', async t => {
  let values = ['abc']
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator<string>(stream)

  for (let value of values) {
    let iteration = await x.next()
    checkIteration(t, iteration, value)
  }
  t.true((await x.next()).done)
})

test('stream some values (legacy)', async t => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = createReadable({ objectMode: true }, values)
  let x = streamToIterator<number | string>(stream)[Symbol.iterator]()
  await x.init()
  for (let value of values) {
    let iteration = x.next()
    await checkLegacyIteration(t, iteration, value)
  }
  t.true(x.next().done)
})

test('stream some values', async t => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = createReadable({ objectMode: true }, values)
  let x = streamToIterator<number | string>(stream)
  for (let value of values) {
    let iteration = await x.next()
    await checkIteration(t, iteration, value)
  }
  t.true((await x.next()).done)
})

test('error on fast iteration (legacy)', async t => {
  let values = [1, 2, 3]
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator<number>(stream)[Symbol.iterator]()
  await x.init()
  x.next()
  t.throws(() => x.next())
})

test('same value on fast iteration', async t => {
  let values = [1, 2, 3]
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator<number>(stream)
  const p1 = x.next()
  const p2 = x.next()
  t.is(await p1, await p2)
})

test('stream some values on non-object mode (legacy)', async t => {
  let values = Buffer.from([65, 66, 67])
  let stream = createReadable({}, values)
  let x = streamToIterator<number>(stream)[Symbol.iterator]()
  await x.init()
  for (let expected of values) {
    let iteration = x.next()
    t.false(iteration.done)
    let actual = await iteration.value
    t.true(expected === actual)
  }
  t.true(x.next().done)
})

test('stream some values on non-object mode', async t => {
  let values = Buffer.from([65, 66, 67])
  let stream = createReadable({}, values)
  let x = streamToIterator<number>(stream)
  for (let expected of values) {
    let iteration = await x.next()
    t.false(iteration.done)
    let actual = await iteration.value
    t.true(expected === actual)
  }
  t.true((await x.next()).done)
})

test('readme example 1', async t => {
  const values = [3, 2, 5]
  const readable = createReadable({ objectMode: true }, values)
  const iterator = await streamToIterator<number>(readable)
    [Symbol.iterator]()
    .init()
  const allValues: number[] = []

  for (let valuePromise of iterator) {
    const value = await valuePromise
    allValues.push(processIterationValue(value))
  }

  t.deepEqual(allValues, [9, 4, 25])

  function processIterationValue(value) {
    return value * value
  }
})

test('readme example 2', async t => {
  let values = [5, 3, 2]
  let readable = createReadable({ objectMode: true }, values)
  let iterator = streamToIterator<number>(readable)
  let allValues: number[] = []

  for await (let value of iterator) {
    allValues.push(processIterationValue(value))
  }

  t.deepEqual(allValues, [25, 9, 4])

  function processIterationValue(value) {
    return value * value
  }
})

async function checkLegacyIteration<T>(
  t: TestContext,
  iteration: IteratorResult<Promise<T>>,
  expected: T
) {
  t.false(iteration.done)
  let value = await iteration.value
  t.deepEqual(value, expected)
}

function checkIteration<T>(
  t: TestContext,
  iteration: IteratorResult<T>,
  expected: T
) {
  t.false(iteration.done)
  let value = iteration.value
  t.deepEqual(value, expected)
}

function createReadable<T>(opts: TransformOptions, items: T[] | Buffer = []) {
  let ret = new PassThrough(opts)
  if (items instanceof Buffer) {
    ret.write(items)
  } else {
    ;(async () => {
      for (let item of items) {
        ret.write(item)
        await delay(10)
      }
      ret.end()
    })()
  }
  return ret
}

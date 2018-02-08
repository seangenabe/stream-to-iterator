import test, { TestContext } from 'ava'
import streamToIterator = require('../lib/index')
import intoStream = require('into-stream')

test('empty stream (legacy)', async t => {
  let stream = intoStream.obj([])
  let x = streamToIterator<never>(stream)[Symbol.iterator]()
  await x.init()
  let i = x.next()
  t.true(i.done)
})

test('empty stream', async t => {
  let stream = intoStream.obj([])
  let x = await streamToIterator<never>(stream)
  await x.init()
  let i = await x.next()
  t.true(i.done)
})

test('stream one value (legacy)', async t => {
  let values = ['abc']
  let stream = intoStream.obj(values)
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
  let stream = intoStream.obj(values)
  let x = await streamToIterator<string>(stream)

  for (let value of values) {
    let iteration = await x.next()
    checkIteration(t, iteration, value)
  }
  const iteration = await x.next()
  t.true(iteration.done)
})

test('stream some values (legacy)', async t => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = intoStream.obj(values)
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
  let stream = intoStream.obj(values)
  let x = streamToIterator<number | string>(stream)
  for (let value of values) {
    let iteration = await x.next()
    await checkIteration(t, iteration, value)
  }
  t.true((await x.next()).done)
})

test('same value on fast iteration (legacy)', async t => {
  let values = [1, 2, 3]
  let stream = intoStream.obj(values)
  let x = await streamToIterator<number>(stream)[Symbol.iterator]()
  await x.init()
  const r1 = x.next()
  const r2 = x.next()
  const v1 = await r1.value
  const v2 = await r2.value
  t.false(r1.done)
  t.false(r2.done)
  t.is(v1, v2)
})

test('same value on fast iteration', async t => {
  let values = [1, 2, 3]
  let stream = intoStream.obj(values)
  let x = await streamToIterator<number>(stream)
  const p1 = x.next()
  const p2 = x.next()
  const r1 = await p1
  const r2 = await p2
  t.false(r1.done)
  t.false(r2.done)
  t.is(r1.value, r2.value)
})

test('stream some values on non-object mode (legacy)', async t => {
  let values = [Buffer.from([65, 66, 67]), Buffer.from([68, 69])]
  let stream = intoStream(values)
  let x = streamToIterator<Buffer>(stream)[Symbol.iterator]()
  await x.init()
  for (let expected of values) {
    let iteration = x.next()
    t.false(iteration.done)
    let actual = await iteration.value
    t.true(expected.equals(actual))
  }
  t.true(x.next().done)
})

test('stream some values on non-object mode', async t => {
  let values = [Buffer.from([65, 66, 67]), Buffer.from([68, 69])]
  let stream = intoStream(values)
  let x = streamToIterator<Buffer>(stream)

  for (let expected of values) {
    let iteration = await x.next()
    t.false(iteration.done)
    t.true(expected.equals(iteration.value))
  }

  const lastIteration = await x.next()
  t.true(lastIteration.done)
})

test('readme example 1', async t => {
  const values = [2, 3, 4]
  const readable = intoStream.obj(values)
  const iterator = await streamToIterator<number>(readable)
    [Symbol.iterator]()
    .init()
  const allValues: number[] = []

  for (let valuePromise of iterator) {
    const value = await valuePromise
    allValues.push(value * value)
  }

  t.deepEqual(allValues, [4, 9, 16])
})

test('readme example 2', async t => {
  let values = [2, 3, 4]
  let readable = intoStream.obj(values)
  let iterator = streamToIterator<number>(readable)
  let allValues: number[] = []

  for await (let value of iterator) {
    allValues.push(value * value)
  }

  t.deepEqual(allValues, [4, 9, 16])
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

import { ok, deepEqual, equal } from 'assert'
import { test, run } from 't0'
import streamToIterator = require('../lib/index')
import intoStream = require('into-stream')

test('empty stream (legacy)', async () => {
  let stream = intoStream.object([])
  let x = streamToIterator<never>(stream)[Symbol.iterator]()
  await x.init()
  let i = x.next()
  ok(i.done)
})

test('empty stream', async () => {
  let stream = intoStream.object([])
  let x = await streamToIterator<never>(stream)
  await x.init()
  let i = await x.next()
  ok(i.done)
})

test('stream one value (legacy)', async () => {
  let values = ['abc']
  let stream = intoStream.object(values)
  let x = streamToIterator<string>(stream)[Symbol.iterator]()
  await x.init()
  for (let value of values) {
    let iteration = x.next()
    await checkLegacyIteration(iteration, value)
  }
  ok(x.next().done)
})

test('stream one value', async () => {
  let values = ['abc']
  let stream = intoStream.object(values)
  let x = await streamToIterator<string>(stream)

  for (let value of values) {
    let iteration = await x.next()
    checkIteration(iteration, value)
  }
  const iteration = await x.next()
  ok(iteration.done)
})

test('stream some values (legacy)', async () => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = intoStream.object(values)
  let x = streamToIterator<number | string>(stream)[Symbol.iterator]()
  await x.init()
  for (let value of values) {
    let iteration = x.next()
    await checkLegacyIteration(iteration, value)
  }
  ok(x.next().done)
})

test('stream some values', async () => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = intoStream.object(values)
  let x = streamToIterator<number | string>(stream)
  for (let value of values) {
    let iteration = await x.next()
    await checkIteration(iteration, value)
  }
  ok((await x.next()).done)
})

test('same value on fast iteration (legacy)', async () => {
  let values = [1, 2, 3]
  let stream = intoStream.object(values)
  let x = await streamToIterator<number>(stream)[Symbol.iterator]()
  await x.init()
  const r1 = x.next()
  const r2 = x.next()
  const v1 = await r1.value
  const v2 = await r2.value
  ok(!r1.done)
  ok(!r2.done)
  equal(v1, v2)
})

test('same value on fast iteration', async () => {
  let values = [1, 2, 3]
  let stream = intoStream.object(values)
  let x = await streamToIterator<number>(stream)
  const p1 = x.next()
  const p2 = x.next()
  const r1 = await p1
  const r2 = await p2
  ok(!r1.done)
  ok(!r2.done)
  equal(r1.value, r2.value)
})

test('stream some values on non-object mode (legacy)', async () => {
  let values = [Buffer.from([65, 66, 67]), Buffer.from([68, 69])]
  let stream = intoStream(values)
  let x = streamToIterator<Buffer>(stream)[Symbol.iterator]()
  await x.init()
  for (let expected of values) {
    let iteration = x.next()
    ok(!iteration.done)
    let actual = await iteration.value
    ok(expected.equals(actual))
  }
  ok(x.next().done)
})

test('stream some values on non-object mode', async () => {
  let values = [Buffer.from([65, 66, 67]), Buffer.from([68, 69])]
  let stream = intoStream(values)
  let x = streamToIterator<Buffer>(stream)

  for (let expected of values) {
    let iteration = await x.next()
    ok(!iteration.done)
    ok(expected.equals(iteration.value))
  }

  const lastIteration = await x.next()
  ok(lastIteration.done)
})

test('readme example 1', async () => {
  const values = [2, 3, 4]
  const readable = intoStream.object(values)
  const iterator = await streamToIterator<number>(readable)
    [Symbol.iterator]()
    .init()
  const allValues: number[] = []

  for (let valuePromise of iterator) {
    const value = await valuePromise
    allValues.push(value * value)
  }

  deepEqual(allValues, [4, 9, 16])
})

test('readme example 2', async () => {
  let values = [2, 3, 4]
  let readable = intoStream.object(values)
  let iterator = streamToIterator<number>(readable)
  let allValues: number[] = []

  for await (let value of iterator) {
    allValues.push(value * value)
  }

  deepEqual(allValues, [4, 9, 16])
})

async function checkLegacyIteration<T>(
  iteration: IteratorResult<Promise<T>>,
  expected: T
) {
  ok(!iteration.done)
  let value = await iteration.value
  deepEqual(value, expected)
}

function checkIteration<T>(iteration: IteratorResult<T>, expected: T) {
  ok(!iteration.done)
  let value = iteration.value
  deepEqual(value, expected)
}

run()

const t = require('ava')
const streamToIterator = require('../')
const { PassThrough } = require('stream')
const delay = require('delay')
const pMapSeries = require('p-map-series')

t("empty stream", async t => {
  let stream = createReadable({ objectMode: true }, [])
  let x = await streamToIterator(stream)
  let i = x.next()
  t.true(i.done)
})

t("stream one value", async t => {
  let values = ['abc']
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator(stream)
  for (let value of values) {
    let iteration = x.next()
    await checkIteration(t, iteration, value)
  }
  t.true(x.next().done)
})

t("stream some values", async t => {
  let values = [5, 'b', Infinity, 'e', 'p']
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator(stream)
  for (let value of values) {
    let iteration = x.next()
    await checkIteration(t, iteration, value)
  }
  t.true(x.next().done)
})

t("error on fast iteration", async t => {
  let values = [1, 2, 3]
  let stream = createReadable({ objectMode: true }, values)
  let x = await streamToIterator(stream)
  x.next()
  t.throws(() => t.next())
})

t("stream some values on non-object mode", async t => {
  let values = [Buffer.from([65, 66, 67]), Buffer.from([68, 69])]
  let stream = createReadable({}, values)
  let x = await streamToIterator(stream)
  for (let expected of values) {
    let iteration = x.next()
    t.false(iteration.done)
    let actual = await iteration.value
    t.true(expected.equals(actual))
  }
  t.true(x.next().done)
})

t("readme example 1", t => {
  let values = [3, 2, 5]
  let readable = createReadable({ objectMode: true }, values)
  let allValuesPromise = streamToIterator(readable)
    .then(iterator =>
      pMapSeries(iterator, processIterationValue)
    )

  return allValuesPromise.then(allValues => {
    t.deepEqual(allValues, [9, 4, 25])
  })

  function processIterationValue(value) {
    return value * value
  }
})

t("readme example 2", async t => {
  let values = [5, 3, 2]
  let readable = createReadable({ objectMode: true }, values)
  let iterator = await streamToIterator(readable)
  let allValues = []

  for (let valuePromise of iterator) {
    allValues.push(processIterationValue(await valuePromise))
  }

  t.deepEqual(allValues, [25, 9, 4])

  function processIterationValue(value) {
    return value * value
  }
})

async function checkIteration(t, iteration, expected) {
  t.false(iteration.done)
  let value = await iteration.value
  t.deepEqual(value, expected)
}

function createReadable(opts, items = []) {
  let ret = new PassThrough(opts)
  ;(async() => {
    for (let item of items) {
      ret.write(item)
      await delay(10)
    }
    ret.end()
  })()
  return ret
}

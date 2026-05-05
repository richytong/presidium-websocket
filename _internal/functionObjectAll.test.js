const assert = require('assert')
const functionObjectAll = require('./functionObjectAll')

describe('functionObjectAll', () => {
  it('Concurrently execute the same arguments for each function of an object of functions, returning an object of results.', async () => {
    assert.deepEqual(await functionObjectAll({
      a: 1,
      b: value => value,
    }, [1]), { a: 1, b: 1 })

    assert.deepEqual(await functionObjectAll({
      a: 1,
      b: value => value,
      c: async value => value,
    }, [1]), { a: 1, b: 1, c: 1 })
  })
})

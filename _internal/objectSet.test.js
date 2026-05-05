const assert = require('assert')
const objectSet = require('./objectSet')

describe('objectSet', () => {
  it('sets a property of an object', async () => {
    const add3 = (a, b, c) => a + b + c
    assert.deepEqual(objectSet({}, 'a', 1), { a: 1 })
  })
})

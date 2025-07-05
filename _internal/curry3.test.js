const assert = require('assert')
const curry3 = require('./curry3')
const __ = require('./placeholder')

describe('curry3', () => {
  it('curries a 3-ary function', async () => {
    const add3 = (a, b, c) => a + b + c
    assert.equal(curry3(add3, 1, 2, __)(3), 6)
    assert.equal(curry3(add3, __, 2, 3)(1), 6)
    assert.equal(curry3(add3, 1, __, 3)(2), 6)
    assert.equal(curry3(add3, 1, 2, __)(3), 6)
  })
})

const assert = require('assert')
const curryArgs2 = require('./curryArgs2')
const __ = require('./placeholder')

describe('curryArgs2', () => {
  it('curries args of a 2-ary function', async () => {
    {
      const add2 = (a, b) => a + b
      const addArgs = (x, args) => args.reduce(add2, x)
      assert.equal(curryArgs2(addArgs, 1, __)(2, 3), 6)
    }

    {
      const add2 = (a, b) => a + b
      const addArgs = (args, x) => args.reduce(add2, x)
      assert.equal(curryArgs2(addArgs, __, 1)(2, 3), 6)
    }
  })
})

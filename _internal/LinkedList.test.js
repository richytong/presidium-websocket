const assert = require('assert')
const LinkedList = require('./LinkedList')

describe('LinkedList', () => {
  it('primitives', async () => {
    const ll = new LinkedList()

    ll.insertAfter(1)
    ll.insertAfter(2, 1)
    ll.append(3)

    assert.equal(ll.length, 3)

    assert.equal(ll.next(0), null)
    assert.equal(ll.next(1), 2)
    assert.equal(ll.next(2), 3)
    assert.equal(ll.next(3), null)
    assert.equal(ll.prev(3), 2)
    assert.equal(ll.prev(2), 1)
    assert.equal(ll.prev(1), null)
    assert.equal(ll.first, 1)
    assert.equal(ll.last, 3)

    assert.deepEqual(ll.sliceFromElement(0), [])
    assert.deepEqual(ll.sliceFromElement(1), [1, 2, 3])

    ll.insertAfter(1.5, 1)
    assert.equal(ll.next(1), 1.5)
    assert.equal(ll.prev(2), 1.5)

    assert.equal(ll.length, 4)

    assert.deepEqual(ll.sliceFromElement(1), [1, 1.5, 2, 3])
    assert.deepEqual(ll.sliceFromElement(1, 1), [1])
    assert.deepEqual(ll.sliceFromElement(1, 2), [1, 1.5])

    ll.delete(2)

    assert.equal(ll.length, 3)

    assert.deepEqual(ll.sliceFromElement(1), [1, 1.5, 3])
    assert.equal(ll.next(0), null)
    assert.equal(ll.next(1), 1.5)
    assert.equal(ll.next(1.5), 3)
    assert.equal(ll.next(3), null)
    assert.equal(ll.prev(3), 1.5)
    assert.equal(ll.prev(1.5), 1)
    assert.equal(ll.prev(1), null)
    assert.equal(ll.first, 1)
    assert.equal(ll.last, 3)

    ll.delete(3)

    assert.equal(ll.length, 2)

    assert.deepEqual(ll.sliceFromElement(1), [1, 1.5])
    assert.equal(ll.next(0), null)
    assert.equal(ll.next(1), 1.5)
    assert.equal(ll.next(1.5), null)
    assert.equal(ll.prev(1.5), 1)
    assert.equal(ll.prev(1), null)
    assert.equal(ll.first, 1)
    assert.equal(ll.last, 1.5)

    ll.delete(1)
    assert.equal(ll.first, 1.5)
    assert.equal(ll.last, 1.5)

    assert.equal(ll.length, 1)

    ll.delete(1.5)
    assert.equal(ll.first, null)
    assert.equal(ll.last, null)

    assert.equal(ll.length, 0)
  })

  it('objects', async () => {
    const ll = new LinkedList({ keyname: 'id' })

    const o0 = { id: 'a' }
    const o1 = { id: 'b' }
    const o2 = { id: 'c' }
    const o3 = { id: 'd' }

    ll.append(o1)
    ll.insertAfter(o2, o1)
    ll.append(o3)

    assert.equal(ll.getByKey('a'), null)
    assert.equal(ll.getByKey('b'), o1)
    assert.equal(ll.getByKey('c'), o2)
    assert.equal(ll.getByKey('d'), o3)

    assert.equal(ll.next(o0), null)
    assert.equal(ll.next(o1), o2)
    assert.equal(ll.next(o2), o3)
    assert.equal(ll.next(o3), null)
    assert.equal(ll.prev(o3), o2)
    assert.equal(ll.prev(o2), o1)
    assert.equal(ll.prev(o1), null)
    assert.equal(ll.first, o1)
    assert.equal(ll.last, o3)

    assert.deepEqual(ll.sliceFromElement(o0), [])
    assert.deepEqual(ll.sliceFromElement(o1), [o1, o2, o3])

    const o1_5 = {}

    ll.insertAfter(o1_5, o1)
    assert.equal(ll.next(o1), o1_5)
    assert.equal(ll.prev(o2), o1_5)

    assert.deepEqual(ll.sliceFromElement(o1), [o1, o1_5, o2, o3])
    assert.deepEqual(ll.sliceFromElement(o1, 1), [o1])
    assert.deepEqual(ll.sliceFromElement(o1, 2), [o1, o1_5])

    ll.delete(o2)

    assert.deepEqual(ll.sliceFromElement(o1), [o1, o1_5, o3])
    assert.equal(ll.next(o0), null)
    assert.equal(ll.next(o1), o1_5)
    assert.equal(ll.next(o1_5), o3)
    assert.equal(ll.next(o3), null)
    assert.equal(ll.prev(o3), o1_5)
    assert.equal(ll.prev(o1_5), o1)
    assert.equal(ll.prev(o1), null)
    assert.equal(ll.first, o1)
    assert.equal(ll.last, o3)

    ll.delete(o3)

    assert.deepEqual(ll.sliceFromElement(o1), [o1, o1_5])
    assert.equal(ll.next(o0), null)
    assert.equal(ll.next(o1), o1_5)
    assert.equal(ll.next(o1_5), null)
    assert.equal(ll.prev(o1_5), o1)
    assert.equal(ll.prev(o1), null)
    assert.equal(ll.first, o1)
    assert.equal(ll.last, o1_5)

    ll.delete(o1)
    assert.equal(ll.first, o1_5)
    assert.equal(ll.last, o1_5)

    ll.delete(o1_5)
    assert.equal(ll.first, null)
    assert.equal(ll.last, null)
  })

  it('findLeft, findRight', async () => {
    const ll = new LinkedList({ keyname: 'n' })

    const o1 = { n: 1 }
    const o2 = { n: 2 }
    const o3 = { n: 3 }
    const o4 = { n: 4 }
    const o5 = { n: 5 }
    const o6 = { n: 6 }
    const o7 = { n: 7 }
    const o8 = { n: 8 }
    const o9 = { n: 9 }
    const o10 = { n: 10 }

    ll.append(o1)
    ll.append(o2)
    ll.append(o3)
    ll.append(o4)
    ll.append(o5)
    ll.append(o6)
    ll.append(o7)
    ll.append(o8)
    ll.append(o9)
    ll.append(o10)

    const found1 = ll.findLeft(o => o.n > 1)
    assert.equal(found1, o2)

    const found2 = ll.findLeft(o => o.n > 5)
    assert.equal(found2, o6)

    const found3 = ll.findLeft(o => o.n >= 10)
    assert.equal(found3, o10)

    const found4 = ll.findLeft(o => o.n > 10)
    assert.equal(found4, null)

    const found5 = ll.findRight(o => o.n < 7)
    assert.equal(found5, o6)

    const found6 = ll.findRight(o => o.n <= 10)
    assert.equal(found6, o10)

    const found7 = ll.findRight(o => o.n < 10)
    assert.equal(found7, o9)

    const found8 = ll.findRight(o => o.n > 2)
    assert.equal(found8, o10)

    const found9 = ll.findRight(o => o.n < 1)
    assert.equal(found9, null)
  })

  it('insertBefore, prepend', async () => {
    const ll = new LinkedList()
    ll.prepend(10)
    ll.prepend(8)
    ll.insertBefore(9, 10)

    assert.deepEqual(ll.sliceFromElement(8), [8, 9, 10])
    assert.equal(ll.prev(10), 9)
    assert.equal(ll.prev(9), 8)
    assert.equal(ll.prev(8), null)
    assert.equal(ll.first, 8)
    assert.equal(ll.last, 10)
  })

  it('findIndex, slice', async () => {
    const ll = new LinkedList()

    ll.append(0)
    ll.append(1)
    ll.append(2)
    ll.append(3)
    ll.append(4)
    ll.append(5)
    ll.append(6)
    ll.append(7)
    ll.append(8)
    ll.append(9)

    assert.equal(ll.length, 10)

    assert.equal(ll.findIndex(n => n == 0), 0)
    assert.equal(ll.findIndex(n => n == 1), 1)
    assert.equal(ll.findIndex(n => n == 8), 8)
    assert.equal(ll.findIndex(n => n == 11), -1)

    assert.deepEqual(ll.slice(0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.deepEqual(ll.slice(0, 1), [0])
    assert.deepEqual(ll.slice(1, 2), [1])
    assert.deepEqual(ll.slice(1, 3), [1, 2])
    assert.deepEqual(ll.slice(5), [5, 6, 7, 8, 9])
    assert.deepEqual(ll.slice(5, 8), [5, 6, 7])
  })

  it('findIndex, slice 2', async () => {
    const ll = new LinkedList()

    for (let i = 0; i < 50; i++) {
      ll.prepend(i)
    }

    assert.equal(ll.length, 50)

    assert.equal(ll.findIndex(n => n == 0), 49)
    assert.equal(ll.findIndex(n => n == 42), 7)
    assert.equal(ll.findIndex(n => n == -1), -1)
  })
})

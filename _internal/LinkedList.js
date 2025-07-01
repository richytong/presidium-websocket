/**
 * @name LinkedList
 *
 * @synopsis
 * ```coffeescript [specscript]
 * type Predicate = (o object|any)=>boolean
 *
 * type LinkedList = {
 *   insertBefore: (o object|any, existing object|any)=>undefined,
 *   prepend: (o object|any)=>undefined,
 *   insertAfter: (o object|any, existing object|any)=>undefined,
 *   append: (o object|any)=>undefined,
 *   delete: (o object|any)=>undefined,
 *   getByKey: (key string)=>(o? object|any),
 *   next: (o object|any)=>(o? object|any)
 *   prev: (o object|any)=>(o? object|any)
 *   sliceFromElement: (o object|any, count number)=>Array,
 *   findLeft: (predicate Predicate)=>(o? object|any),
 *   findRight: (predicate Predicate)=>(o? object|any),
 *   findIndex: (predicate Predicate)=>(o? object|any),
 *   slice: (from number, xto? number)=>Array,
 *   length: number,
 * }
 *
 * new LinkedList(options? {
 *   keyname?: string,
 * }) -> LinkedList
 * ```
 */
class LinkedList {
  constructor(options = {}) {
    // nextMap Map<(element object)=>(nextElement object)>
    this.nextMap = new Map()
    this.prevMap = new Map()
    this.last = null
    this.first = null

    if (options.keyname) {
      this.keyname = options.keyname
      this.keyMap = new Map()
    }
  }

  /**
   * @name length
   *
   * @synopsis
   * ```coffeescript [specscript]
   * length number
   * ```
   */
  get length() {
    return Math.max(this.nextMap.size, this.prevMap.size)
  }

  /**
   * @name insertBefore
   *
   * @synopsis
   * ```coffeescript [specscript]
   * insertBefore(o object|any, existing? object|any) -> undefined
   * ```
   */
  insertBefore(o, existing) {
    const { nextMap, prevMap, first, last, keyname } = this

    if (existing != null) {
      const existingPrev = prevMap.get(existing)
      if (existingPrev != null) {
        prevMap.set(o, existingPrev)
        nextMap.set(existingPrev, o)
      } else {
        prevMap.set(o, null)
      }
      prevMap.set(existing, o)
      nextMap.set(o, existing)
    } else {
      prevMap.set(o, null)
    }

    if (first == null || first == existing) {
      this.first = o
    }

    if (last == null) {
      this.last = o
    }

    if (keyname) {
      const key = o[keyname]
      this.keyMap.set(key, o)
    }
  }

  /**
   * @name prepend
   *
   * @synopsis
   * ```coffeescript [specscript]
   * prepend(o object|any) -> undefined
   * ```
   */
  prepend(o) {
    this.insertBefore(o, this.first)
  }

  /**
   * @name insertAfter
   *
   * @synopsis
   * ```coffeescript [specscript]
   * insertAfter(o object|any, existing? object|any) -> undefined
   * ```
   */
  insertAfter(o, existing) {
    const { nextMap, prevMap, first, last, keyname } = this

    if (existing != null) {
      const existingNext = nextMap.get(existing)
      if (existingNext != null) {
        nextMap.set(o, existingNext)
        prevMap.set(existingNext, o)
      } else {
        nextMap.set(o, null)
      }
      nextMap.set(existing, o)
      prevMap.set(o, existing)
    } else {
      nextMap.set(o, null)
    }

    if (first == null) {
      this.first = o
    }

    if (last == null || last == existing) {
      this.last = o
    }

    if (keyname) {
      const key = o[keyname]
      this.keyMap.set(key, o)
    }
  }

  /**
   * @name append
   *
   * @synopsis
   * ```coffeescript [specscript]
   * append(o object|any) -> undefined
   * ```
   */
  append(o) {
    this.insertAfter(o, this.last)
  }

  /**
   * @name delete
   *
   * @synopsis
   * ```coffeescript [specscript]
   * delete(o object|any) -> undefined
   * ```
   */
  delete(o) {
    const { nextMap, prevMap, first, last, keyname } = this

    const next = nextMap.get(o)
    const prev = prevMap.get(o)

    if (next && prev) { // o is middle item
      nextMap.set(prev, next)
      prevMap.set(next, prev)
    } else if (next) { // o is first item, next is after o
      prevMap.set(next, null) // nothing before next once o is gone
    } else if (prev) { // o is last item, prev is before o
      nextMap.set(prev, null) // nothing after prev once o is gone
    }

    nextMap.delete(o)
    prevMap.delete(o)

    if (o == first) {
      this.first = next
    }

    if (o == last) {
      this.last = prev
    }

    if (keyname) {
      const key = o[keyname]
      this.keyMap.delete(key)
    }
  }

  /**
   * @name
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getByKey(key string) -> o? object|any
   * ```
   */
  getByKey(key) {
    return this.keyMap.get(key)
  }

  /**
   * @name next
   *
   * @synopsis
   * ```coffeescript [specscript]
   * next(o object|any) -> nextObject
   * ```
   */
  next(o) {
    return this.nextMap.get(o)
  }

  /**
   * @name prev
   *
   * @synopsis
   * ```coffeescript [specscript]
   * prev(o object|any) -> nextObject
   * ```
   */
  prev(o) {
    return this.prevMap.get(o)
  }

  /**
   * @name sliceFromElement
   *
   * @synopsis
   * ```coffeescript [specscript]
   * sliceFromElement(o object|any, count? number) -> Array<object|any>
   * ```
   */
  sliceFromElement(o, count = Infinity) {
    const { nextMap } = this
    const result = []

    if (!nextMap.has(o)) {
      return []
    }

    let cur = o
    result.push(cur)
    cur = nextMap.get(cur)

    while (cur && result.length < count) {
      result.push(cur)
      cur = nextMap.get(cur)
    }

    return result
  }

  /**
   * @name findLeft
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type Predicate = (o object|any)=>boolean
   *
   * findLeft(predicate Predicate) -> o? object|any
   * ```
   */
  findLeft(predicate) {
    let cur = this.first
    if (predicate(cur)) {
      return cur
    }
    cur = this.next(cur)
    while (cur) {
      if (predicate(cur)) {
        return cur
      }
      cur = this.next(cur)
    }
    return undefined
  }

  /**
   * @name findRight
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type Predicate = (o object|any)=>boolean
   *
   * findRight(predicate Predicate) -> o? object|any
   * ```
   */
  findRight(predicate) {
    let cur = this.last
    if (predicate(cur)) {
      return cur
    }
    cur = this.prev(cur)
    while (cur) {
      if (predicate(cur)) {
        return cur
      }
      cur = this.prev(cur)
    }
    return undefined
  }

  /**
   * @name findIndex
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type Predicate = (o object|any)=>boolean
   *
   * findIndex(predicate Predicate) -> index number
   * ```
   */
  findIndex(predicate) {
    let index = 0
    let cur = this.first
    if (predicate(cur)) {
      return index
    }
    while (cur != null) {
      index += 1
      cur = this.next(cur)
      if (predicate(cur)) {
        return index
      }
    }
    return -1
  }


  /**
   * @name slice
   *
   * @synopsis
   * ```coffeescript [specscript]
   * slice(from number, xto? number) -> Array
   * ```
   */
  slice(from, xto = Infinity) {
    if (this.first == null) {
      return []
    }

    let cur = this.first
    let index = 0

    while (index < from) {
      cur = this.next(cur)
      if (cur == null) {
        return []
      }
      index += 1
    }

    // index == from
    const result = [cur]
    index += 1

    while (index < xto) {
      cur = this.next(cur)
      if (cur == null) {
        break
      }
      result.push(cur)
      index += 1
    }

    return result
  }

  /**
   * @name shift
   *
   * @docs
   * Remove and return leftmost element.
   *
   * ```coffeescript [specscript]
   * shift() -> o? object|any
   * ```
   */
  shift() {
    const element = this.first
    this.delete(this.first)
    return element
  }
}

module.exports = LinkedList

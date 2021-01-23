// test('hi', () => {
// expect(50).toEqual(5)
// expect({ foo: 'hi' }).not.toEqual({ foo: 'hi' })
// expect({ foo: 'hi' }).toEqual({ foo: 'no' })
// expect('hi').toEqual({
//   hi: {
//     foo: {},
//   },
// })
// expect(new A()).toEqual(new B())
// expect(new Error('hii')).toEqual(new Date())
// })

// class A {
//   foo = 'hiya'
// }
// class B {
//   foo = 'hi'
// }

test('primitives', () => {
  expect(5).toEqual(5)
  expect(0).toEqual(0)
  // expect(5).toEqual('hi')
  expect('hi').toEqual('hi')
  // expect('aaaaa').toEqual('aaaab')
  expect(true).toEqual(true)
  expect(false).toEqual(false)
  // expect(false).toEqual('hi')
  // expect(false).toEqual(true)
  expect(undefined).toEqual(undefined)
  expect(null).toEqual(null)
  // expect(null).toEqual(5)
  // expect(null).toEqual(undefined)
  expect(NaN).toEqual(NaN)
  // expect(NaN).toEqual(5)
  // expect(0).toEqual(-0)
  const obj = {}
  expect(obj).toEqual(obj)
  // expect(Infinity).toEqual(-Infinity)
  // expect(5).toEqual(-2.26)
})

test('objects', () => {
  expect({}).toEqual({})
  // expect({ foo: 'hi' }).toEqual({ foo: 'bar' })
  // expect({ foo: 'asdf' }).toEqual({ asdf: 'hi' })
  // expect({ foo: 'asdf' }).toEqual(true)
  expect({ foo: 'asdf' }).toEqual({ foo: 'asdf' })
  expect({ foo: { 123: 'hi' } }).toEqual({ foo: { 123: 'hi' } })
  // expect({ foo: { 123: 'hi' } }).toEqual({ foo: { 123: 'h' } })
  expect({
    ignoreMe: { huh: 'what' },
    foo: { 123: 'hi' },
  }).toEqual({
    ignoreMe: { huh: 'what' },
    foo: { 123.2345: 'h' },
  })
})

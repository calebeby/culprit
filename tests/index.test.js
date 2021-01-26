// // test('hi', () => {
// // expect(50).toEqual(5)
// // expect({ foo: 'hi' }).not.toEqual({ foo: 'hi' })
// // expect({ foo: 'hi' }).toEqual({ foo: 'no' })
// // expect('hi').toEqual({
// //   hi: {
// //     foo: {},
// //   },
// // })
// // expect(new A()).toEqual(new B())
// // expect(new Error('hii')).toEqual(new Date())
// // })

// // class A {
// //   foo = 'hiya'
// // }
// // class B {
// //   foo = 'hi'
// // }

// test('primitives', () => {
//   expect(5).toEqual(5)
//   expect(0).toEqual(0)
//   // expect(5).toEqual('hi')
//   expect('hi').toEqual('hi')
//   // expect('aaaaa').toEqual('aaaab')
//   expect(true).toEqual(true)
//   expect(false).toEqual(false)
//   // expect(false).toEqual('hi')
//   // expect(false).toEqual(true)
//   expect(undefined).toEqual(undefined)
//   expect(null).toEqual(null)
//   // expect(null).toEqual(5)
//   // expect(null).toEqual(undefined)
//   expect(NaN).toEqual(NaN)
//   // expect(NaN).toEqual(5)
//   // expect(0).toEqual(-0)
//   const obj = {}
//   expect(obj).toEqual(obj)
//   // expect(Infinity).toEqual(-Infinity)
//   // expect(5).toEqual(-2.26)
// })

// test('errors', () => {
//   expect(new Error('hi')).toEqual(new Error('hi'))
//   // expect(new Error('hiiii')).toEqual(new Error('hi'))
//   // expect({ foo: new Error('hiiii') }).toEqual({ foobar: new Error('hi') })
//   // expect({ foo: new Error('hiiii') }).toEqual({ foo: new Error('hi') })
//   expect({ foo: new Error('hi') }).toEqual({ foo: new Error('hi') })
//   // expect({ foo: new Error('hi') }).toEqual({ foo: new Error('hi'), bar: 'hi' })
// })

// test('objects', () => {
//   expect({}).toEqual({})
//   // expect({
//   //   foo: 'hiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
//   // }).toEqual({
//   //   foo: 'bar',
//   // })
//   // expect({ foo: 'hi' }).toEqual({ foo: 'bar' })
//   // expect({ foo: 'asdf' }).toEqual({ asdf: 'hi' })
//   // expect({ foo: 'asdf' }).toEqual(true)
//   expect({ foo: 'asdf' }).toEqual({ foo: 'asdf' })
//   expect({ foo: { 123: 'hi' } }).toEqual({ foo: { 123: 'hi' } })
//   // expect({ foo: { 123: 'hi' } }).toEqual({ foo: { 123: 'h' } })
//   // expect({
//   //   ignoreMe: { huh: 'what' },
//   //   foo: { 123: 'hi' },
//   // }).toEqual({
//   //   ignoreMe: { huh: 'what' },
//   //   foo: { 123.2345: 'h' },
//   // })
//   // expect(null).toEqual({})
//   // expect({}).toEqual(null)
// })

test('toThrow', () => {
  // expect(new Error('aaahhhhh')).toThrow('aah')
  // expect(() => {}).toThrow('aah')
  // expect(() => {}).toThrow()
  expect(() => {
    throw 'aah'
  }).toThrow('aah')
  // expect(() => {
  //   throw 'aaaah'
  // }).toThrow('notEqual')
  expect(() => {
    throw { foo: 'bar' }
  }).toThrow({ foo: 'bar' })
  // expect(() => {
  //   throw { foo: 'asdfasdf' }
  // }).toThrow({ foo: 'bar' })
  // expect(() => {
  //   throw new Error('hi')
  // }).toThrow('hi')
  expect(() => {
    throw new Error('hi')
  }).toThrow(new Error('hi'))
  // expect(() => {
  //   throw new Error('hiiiii')
  // }).toThrow(new Error('hi'))
  const thrown = expect(() => {
    throw 'hi'
  }).toThrow()
  expect(thrown).toEqual('hi')
})

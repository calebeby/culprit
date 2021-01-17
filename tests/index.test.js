test('hi', () => {
  // expect(50).toEqual(5)
  // expect({ foo: 'hi' }).not.toEqual({ foo: 'hi' })
  expect({ foo: 'hi' }).toEqual({ foo: 'no' })
  // expect(new A()).toEqual(new B())

  // expect(new Error('hii')).toEqual(new Date())
})

class A {
  foo = 'hiya'
}
class B {
  foo = 'hi'
}

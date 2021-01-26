import {
  printStructured,
  expectedColor,
  formatDiff,
  receivedColor,
} from './print-diff'
import * as colors from 'kolorist'

export const NOT_EXIST = Symbol()

export type Structured =
  | StructuredPrimitive
  | StructuredObject
  | StructuredError

export type Diff<ValueType, NotExistType = never> =
  | ValueType
  | {
      expected: ValueType | NotExistType
      received: ValueType | NotExistType
    }

interface StructuredObject {
  type: 'Object'
  properties: StructuredProperty[]
}

interface StructuredError {
  type: 'Error'
  message: Diff<string>
}

interface StructuredProperty {
  key: string
  value: Diff<Structured, typeof NOT_EXIST>
}

interface StructuredPrimitive {
  type: 'Primitive'
  value: Diff<string | number | boolean | null | undefined>
}

const toStructured = (value: unknown): Structured => {
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    value === null ||
    typeof value === 'undefined'
  ) {
    return { type: 'Primitive', value }
  }
  if (typeof value === 'object') {
    if (value instanceof Error) {
      return {
        type: 'Error',
        message: value.message,
      }
    }
    return {
      type: 'Object',
      properties: Object.entries(value as {}).map(([key, val]) => {
        return { key, value: toStructured(val) }
      }),
    }
  }
  throw new Error(`unhandled value in toStructured: ${value}`)
}

var has = Object.prototype.hasOwnProperty

const compare = (
  expected: unknown,
  received: unknown,
): { diff: Diff<Structured>; isEqual: boolean } => {
  if (Object.is(expected, received)) {
    return {
      isEqual: true,
      diff: toStructured(expected),
    }
  }
  if (
    typeof expected !== typeof received ||
    expected === null || // check this in case typeof null === 'object'
    received === null // we know they are not both null because we checked Object.is
  ) {
    return {
      isEqual: false,
      diff: {
        received: toStructured(received),
        expected: toStructured(expected),
      },
    }
  }
  if (
    typeof expected === 'number' ||
    typeof expected === 'string' ||
    typeof expected === 'boolean'
  ) {
    return {
      isEqual: false,
      diff: {
        type: 'Primitive',
        value: { expected, received: received as typeof expected },
      },
    }
  }
  if (typeof expected === 'object') {
    // we've already eliminated the case that either is null

    if (expected instanceof Error && received instanceof Error) {
      // TODO: check/diff Error.name too? And/or the constructor (name?)
      const isEqual = expected.message === received.message
      return {
        isEqual,
        diff: isEqual
          ? toStructured(expected)
          : {
              type: 'Error',
              message: {
                expected: expected.message,
                received: received.message,
              },
            },
      }
    }

    let isEqual = true
    const properties: { [key: string]: StructuredProperty } = {}
    let key,
      valDiff,
      prop = {} as StructuredProperty
    for (key in expected) {
      if (!has.call(expected, key)) continue // inherited/prototype
      prop = { key } as StructuredProperty
      if (has.call(received, key)) {
        // @ts-expect-error
        valDiff = compare(expected[key], received[key])
        if (!valDiff.isEqual) isEqual = false
        prop.value = valDiff.diff
      } else {
        prop.value = {
          // @ts-expect-error
          expected: toStructured(expected[key]),
          received: NOT_EXIST,
        }
        isEqual = false
      }
      properties[key] = prop
    }
    for (key in received as {}) {
      if (properties[key]) continue
      if (!has.call(received, key)) continue // inherited/prototype
      isEqual = false
      properties[key] = {
        key,
        value: {
          expected: NOT_EXIST,
          // @ts-expect-error
          received: toStructured(received[key]),
        },
      }
    }
    return {
      isEqual,
      diff: {
        type: 'Object',
        properties: Object.values(properties),
      },
    }
  }
  throw new Error(`unhandled value in compare: ${expected}`)
}

const printRecieved = (received: unknown) =>
  receivedColor(printStructured(toStructured(received)))

const printExpected = (expected: unknown) =>
  expectedColor(printStructured(toStructured(expected)))

const expect = (received: unknown) => {
  const matchers = {
    toEqual(expected: unknown) {
      // shortcut to skip printing
      if (Object.is(expected, received)) return
      const { diff, isEqual } = compare(expected, received)
      if (isEqual) return

      const message = `expect(${receivedColor(
        'received',
      )}).toEqual(${expectedColor('expected')})

${formatDiff(diff)}`

      throw removeFuncFromStackTrace(
        new MatcherError(message),
        matchers.toEqual,
      )
    },
    toThrow(...args: [expected?: unknown]) {
      const [expected] = args
      const hasExpected = args.length > 0 ? true : ''
      // received is the function to call
      const fnHint = colors.blue('func')
      const matcherHint = `expect(${fnHint}).toThrow(${
        hasExpected && expectedColor('expected')
      })`
      if (typeof received !== 'function') {
        const msg = `${matcherHint}

${fnHint} must be a function

${fnHint} was ${printRecieved(received)}`
        throw removeFuncFromStackTrace(new MatcherError(msg), matchers.toThrow)
      }
      let thrown: unknown
      let didThrow = false
      try {
        // call the function, make sure it throws
        received()
      } catch (_thrown) {
        thrown = _thrown
        didThrow = true
      }
      if (!didThrow) {
        const msg = `${matcherHint}

${
  hasExpected &&
  `Expected ${fnHint} to throw ${printExpected(expected)}

But `
}${fnHint} ${receivedColor('did not throw')}`
        throw removeFuncFromStackTrace(new MatcherError(msg), matchers.toThrow)
      }
      if (!hasExpected) return thrown
      // shortcut to skip printing
      if (Object.is(expected, thrown)) return thrown
      const { diff, isEqual } = compare(expected, thrown)
      if (isEqual) return thrown

      const message = `${matcherHint}

${fnHint} did not throw the ${expectedColor('expected')} value

${formatDiff(diff)}`

      throw removeFuncFromStackTrace(
        new MatcherError(message),
        matchers.toThrow,
      )
    },
  }
  return matchers
}

class MatcherError extends Error {}

/**
 * Manipulate the stack trace and remove fn from it
 * That way jest will show a code frame from the user's code, not ours
 * https://kentcdodds.com/blog/improve-test-error-messages-of-your-abstractions
 */
const removeFuncFromStackTrace = (
  error: Error,
  fn: (...params: any[]) => any,
) => {
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, fn)
  }
  return error
}

export default expect

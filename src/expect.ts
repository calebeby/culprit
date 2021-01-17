import * as colors from 'kolorist'
import * as IRC from './irc'
import type { IR, Marker } from './irc'

const expectedColor = colors.green
const receivedColor = colors.red

const NOT_EXIST = Symbol()

type Structured = StructuredString | StructuredObject

type Diff<T> =
  | T
  | { expected: T | typeof NOT_EXIST; received: T | typeof NOT_EXIST }

interface StructuredObject {
  type: 'Object'
  properties: {
    key: string
    value: Diff<Structured>
  }[]
}

interface StructuredString {
  type: 'String'
  value: Diff<string>
}

const printDiff = (expected: any, received: any): StructuredObject => {
  return {
    type: 'Object',
    properties: [
      {
        key: 'foo',
        value: {
          type: 'String',
          value: {
            expected: 'hiiiiiiii',
            received: 'noooooooo',
          },
        },
      },
      {
        key: 'sdf',
        value: {
          expected: {
            type: 'Object',
            properties: [
              {
                key: 'hi',
                value: {
                  type: 'String',
                  // value: 'hiiiiiiiiiiiiiiiiiiiiiiiiiiii',
                  value: 'hiiiiiiiiiiiiiii',
                },
              },
            ],
          },
          received: { type: 'String', value: 'hi' },
        },
      },
      {
        key: 'hi',
        value: {
          type: 'Object',
          properties: [
            {
              key: 'hiiii',
              value: {
                expected: {
                  type: 'String',
                  value: 'hi',
                },
                received: {
                  type: 'Object',
                  properties: [],
                },
              },
            },
            {
              key: 'hi2',
              value: {
                type: 'String',
                value: 'hi',
              },
            },
          ],
        },
      },
      {
        key: 'asdf',
        value: {
          expected: NOT_EXIST,
          received: { type: 'String', value: 'asdfProp' },
        },
      },
      {
        key: 'asdf2',
        value: {
          expected: { type: 'String', value: 'asdf2Prop' },
          received: NOT_EXIST,
        },
      },
      {
        key: 'asdf-3',
        value: {
          type: 'String',
          value: 'asdf3Prop',
        },
      },
    ],
  }
}

// this is naiive it doesn't handle reserved words or unicode
const IDENTIFIER_REGEX = /^[$A-Z_][0-9A-Z_$]*$/i

const [expOpen, expClose] = expectedColor('reee')
  .split('reee')
  .map((c) => IRC.text(c, 0))
const [recOpen, recClose] = receivedColor('reee')
  .split('reee')
  .map((c) => IRC.text(c, 0))

const diffPropertyToIR = (
  prop: { key: string; value: Diff<Structured> },
  marker?: Marker,
) => {
  const key = IDENTIFIER_REGEX.test(prop.key)
    ? prop.key
    : JSON.stringify(prop.key)
  const valueIR = diffToIR(prop.value)
  // it formats in one of these ways:
  // property: [ ... ],
  // The next case is only if the value is not a group:
  // property:
  //   "really long string did not fit"
  // The next case is if the value is a group, the group gets split:
  // property: new Date(
  //   asdf
  // )
  const propertyIR: IR[] = [key + ':']
  if (
    typeof valueIR === 'object' &&
    !Array.isArray(valueIR) &&
    valueIR.type === IRC.types.IR_GROUP
  ) {
    propertyIR.push(' ', valueIR)
  } else {
    propertyIR.push(
      IRC.ifBreak(IRC.indent([IRC.line, valueIR]), [' ', valueIR]),
    )
  }
  return IRC.group(propertyIR, marker)
}

const diffToIR = (diff: Diff<Structured>): IR => {
  if ('type' in diff) {
    if (diff.type === 'Object') {
      if (diff.properties.length === 0) return '{}'
      const objectIR: IR[] = []
      const lastProp = diff.properties[diff.properties.length - 1]
      for (const prop of diff.properties) {
        const comma = prop === lastProp ? IRC.ifBreak(',', '') : ','
        objectIR.push(IRC.lineOrSpace)
        // the values are the same type, so the key will be printed only once
        if ('type' in prop.value) {
          objectIR.push(diffPropertyToIR(prop), comma)
        } else {
          // The values are different types, so the key will be printed twice:
          // property: [ ... ]
          // property: "asdf"
          const { expected, received } = prop.value
          if (expected !== NOT_EXIST)
            objectIR.push(
              expOpen,
              diffPropertyToIR({ key: prop.key, value: expected }, '-'),
              comma,
              expClose,
              received !== NOT_EXIST ? IRC.line : '',
            )
          if (received !== NOT_EXIST)
            objectIR.push(
              recOpen,
              diffPropertyToIR({ key: prop.key, value: received }, '+'),
              comma,
              recClose,
            )
        }
      }
      return IRC.group([
        '{',
        IRC.ifBreak(IRC.indent(objectIR), objectIR),
        IRC.lineOrSpace,
        '}',
      ])
    }
    if (diff.type === 'String') {
      if (typeof diff.value === 'string') return '"' + diff.value + '"'
      const out: IR[] = []
      const { expected, received } = diff.value
      if (expected !== NOT_EXIST) {
        out.push('"' + expectedColor(expected) + '"')
        if (received !== NOT_EXIST) out.push(IRC.line)
      }
      if (received !== NOT_EXIST) out.push('"' + receivedColor(received) + '"')
      return out
    }
    return 'Toad'
  } else {
    // TODO
  }
  return 'TOODOOO'
}

const printWidth = 40
const indentWidth = 2

const fits = (commands: IR[], width: number) => {
  let cmd: IR,
    cmdIdx = 0
  // the order of the items in the queue doesn't actually matter
  // since we are just measuring the width
  const queue = commands.slice() // make a copy because we will modify it
  while (width > 0) {
    if (cmdIdx >= queue.length) return true
    cmd = queue[cmdIdx]
    if (typeof cmd === 'string') {
      width -= cmd.length
    } else if (Array.isArray(cmd)) {
      queue.push(...cmd)
    } else if (cmd.type === IRC.types.IR_TEXT) {
      width -= cmd.width
    } else if (cmd.type === IRC.types.IR_LINE) {
      // there is a line break, therefore it won't fit in the allocated space
      return false
    } else if (cmd.type === IRC.types.IR_GROUP) {
      if (cmd.shouldBreak) return false
      queue.push(...cmd.children)
    } else if (cmd.type === IRC.types.IR_IF_BREAK) {
      // in order to see if everything will fit in one line,
      // measure using the non-broken version
      queue.push(cmd.ifNotBreak)
    } else if (cmd.type === IRC.types.IR_INDENT) {
      // we don't care about the actual width of the indent (maybe we should?) TODO
      queue.push(...cmd.children)
    } else {
      // ignoring: dedent
    }

    cmdIdx++
  }
  return false
}

const POP_GROUP_STACK = Symbol('POP_GROUP_STACK')

const IRToString = (ir: IR) => {
  // the queue holds next-to-handle items at the end
  // (so it is in reverse of the actual output)
  const queue: (IR | typeof POP_GROUP_STACK)[] = [ir]
  let cmd: IR | typeof POP_GROUP_STACK | undefined
  let out: string[] = []
  const groupStack: IRC.Group[] = []
  /** Position in current line (including indents) */
  let pos = 0
  let currentIndent = 0
  while ((cmd = queue.pop()) !== undefined) {
    if (typeof cmd === 'string') {
      out.push(cmd)
      pos += cmd.length
    } else if (Array.isArray(cmd)) {
      queue.push(...cmd.slice().reverse())
    } else if (cmd === POP_GROUP_STACK) {
      groupStack.pop()
    } else if (cmd.type === IRC.types.IR_TEXT) {
      // TODO: handle markers
      out.push(cmd.text)
      pos += cmd.width
    } else if (cmd.type === IRC.types.IR_GROUP) {
      groupStack.push(cmd)
      const remainingSpaceInLine = printWidth - pos
      const needsToBreak =
        cmd.shouldBreak || !fits(cmd.children, remainingSpaceInLine)
      // queue is backwards
      queue.push(POP_GROUP_STACK, ...cmd.children.slice().reverse())
      cmd.shouldBreak = needsToBreak
    } else if (cmd.type === IRC.types.IR_LINE) {
      out.push('\n' + ' '.repeat(currentIndent))
      pos = currentIndent // reset the position to just the indent since we are on a new line
    } else if (cmd.type === IRC.types.IR_IF_BREAK) {
      const { shouldBreak } = groupStack[groupStack.length - 1] || {}
      queue.push(shouldBreak ? cmd.ifBreak : cmd.ifNotBreak)
    } else if (cmd.type === IRC.types.IR_INDENT) {
      // ends with newline, put an indent after that
      if (out[out.length - 1] === '\n') {
        out.push(' '.repeat(currentIndent), '\n')
      }
      // queue is backwards
      queue.push(IRC.dedent, ...cmd.children.slice().reverse())
      currentIndent += indentWidth
    } else if (cmd.type === IRC.types.IR_DEDENT) {
      currentIndent -= indentWidth
    } else {
      // @ts-expect-error
      throw new Error(`unhandled, ${String(cmd.type)}`)
    }
  }
  return out.join('')
}

const formatDiff = (diff: StructuredObject) => {
  return IRToString(diffToIR(diff))
}

const expect = (received: unknown) => {
  const matchers = {
    toEqual(expected: any) {
      const diff = printDiff(expected, received)

      const diffString = formatDiff(diff)

      const message = `expect(${receivedColor(
        'received',
      )}).toEqual(${expectedColor('expected')})

${expectedColor('- Expected')}
${receivedColor('+ Received')}

${diffString}`

      throw removeFuncFromStackTrace(
        new MatcherError(message),
        matchers.toEqual,
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

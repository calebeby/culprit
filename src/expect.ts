import * as colors from 'kolorist'
import * as IRC from './irc'
import type { IR } from './irc'

const expectedColor = <T extends any>(input: T) => {
  if (typeof input === 'string') return colors.green(input)
  return [expOpen, input, expClose]
}

const receivedColor = <T extends any>(input: T) => {
  if (typeof input === 'string') return colors.red(input)
  return [recOpen, input, recClose]
}

const delim = '\0\0'

const [expOpen, expClose] = colors
  .green(delim)
  .split(delim)
  .map((c) => IRC.text(c, 0))

const [recOpen, recClose] = colors
  .red(delim)
  .split(delim)
  .map((c) => IRC.text(c, 0))

const NOT_EXIST = Symbol()

type Structured = StructuredString | StructuredObject

type Diff<ValueType, NotExistType = never> =
  | ValueType
  | {
      expected: ValueType | NotExistType
      received: ValueType | NotExistType
    }

interface StructuredObject {
  type: 'Object'
  properties: {
    key: string
    value: Diff<Structured, typeof NOT_EXIST>
  }[]
}

interface StructuredString {
  type: 'String'
  value: Diff<string>
}

const printDiff = (expected: any, received: any): Structured => {
  return {
    type: 'Object',
    properties: [
      {
        key: 'firstBreaks',
        value: {
          type: 'String',
          value: {
            expected: 'too long-------------------------------------',
            received: 'short',
          },
        },
      },
      {
        key: 'secondBreaks',
        value: {
          type: 'String',
          value: {
            expected: 'short',
            received: 'too long-------------------------------------',
          },
        },
      },
      {
        key: 'neitherBreaks',
        value: {
          type: 'String',
          value: {
            expected: 'short',
            received: 'also short',
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
                  value: 'hiiiiiiiiiiiiiiiiiiiiiiiiiiii',
                  // value: 'hiii',
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

const isGroup = (ir: IR): ir is IRC.Group => {
  while (Array.isArray(ir)) {
    if (ir.length !== 1) return false
    ir = ir[0]
  }
  if (typeof ir === 'string') return false
  return 'type' in ir && ir.type === IRC.types.IR_GROUP
}

const propertyToIR = (
  key: string,
  value: Diff<Structured, typeof NOT_EXIST>,
): IR => {
  if ('expected' in value) {
    if (value.expected === NOT_EXIST && value.received !== NOT_EXIST)
      return receivedColor(propertyToIR(key, value.received))
    if (value.received === NOT_EXIST && value.expected !== NOT_EXIST)
      return expectedColor(propertyToIR(key, value.expected))
    if (value.expected === NOT_EXIST && value.received === NOT_EXIST) return []
  }
  const keyStr = (IDENTIFIER_REGEX.test(key) ? key : JSON.stringify(key)) + ':'
  const valueIR = diffToIR(value as Diff<Structured>)
  if (typeof valueIR === 'object' && 'expected' in valueIR) {
    return [
      IRC.forceBreak, // force the parent to break regardless because even in the "unbroken" state this takes up multiple lines
      IRC.group([
        keyStr,
        IRC.indent([IRC.ifBreak(IRC.line, ' '), valueIR.expected]),
        ',',
        IRC.ifBreak(
          IRC.indent([IRC.line, valueIR.received]), // don't print the key a 2nd time
          [IRC.lineNonBreaking, keyStr, IRC.indent([' ', valueIR.received])],
        ),
      ]),
    ]
  }
  // if the value is a group, then that means it is expandable
  // If it is expandable, like an object, then we won't put a lineOrSpace after :
  // foo: {
  //   ...
  // }
  if (isGroup(valueIR)) {
    return [keyStr + ' ', valueIR]
  }
  // otherwise the value is not a group, so it is probably not expandable:
  // So we will put a lineOrSpace after : and do a conditional indent:
  // foo:
  //   "longString"

  // the indent has no effect if it doesn't break, since no newlines are printed
  return IRC.group([keyStr, IRC.indent([IRC.lineOrSpace, valueIR])])
}

const diffToIR = (diff: Diff<Structured>): IR => {
  if ('type' in diff) {
    if (diff.type === 'Object') {
      if (diff.properties.length === 0) return '{}'
      const objectIR: IR[] = []
      const lastProp = diff.properties[diff.properties.length - 1]
      for (const prop of diff.properties) {
        const comma = prop === lastProp ? IRC.ifBreak(',', '') : ','
        objectIR.push(
          IRC.lineOrSpace,
          propertyToIR(prop.key, prop.value),
          comma,
        )
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
      const { expected, received } = diff.value
      return {
        expected: '"' + expectedColor(expected) + '"',
        received: '"' + receivedColor(received) + '"',
      }
    }
    return 'Toad'
  }
  return {
    expected: expectedColor(diffToIR(diff.expected)),
    received: receivedColor(diffToIR(diff.received)),
  }
}

const printWidth = 43
// const printWidth = 30
const indentWidth = 2

const fits = (commands: IR[], width: number) => {
  let cmd: IR,
    cmdIdx = 0,
    origWidth = width
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
    } else if ('expected' in cmd) {
      return false // doesn't fit because it has separate expected/received, which requires >1 line
    } else if (cmd.type === IRC.types.IR_TEXT) {
      width -= cmd.width
    } else if (
      cmd.type === IRC.types.IR_LINE ||
      cmd.type === IRC.types.IR_FORCE_BREAK
    ) {
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
      // the indent doesn't actually have any effect unless a newline is printed
      queue.push(...cmd.children)
    } else if (cmd.type === IRC.types.IR_LINE_NON_BREAKING) {
      // a new line was formed
      // since it is marked as non breaking don't break the group
      // reset the measurement width
      width = origWidth
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
    } else if ('expected' in cmd) {
      // separate expected/received properties
      queue.push(cmd.received, IRC.line, cmd.expected)
      throw new Error('aaah')
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
    } else if (
      cmd.type === IRC.types.IR_LINE ||
      cmd.type === IRC.types.IR_LINE_NON_BREAKING
    ) {
      out.push('\n' + ' '.repeat(currentIndent))
      pos = currentIndent // reset the position to just the indent since we are on a new line
    } else if (cmd.type === IRC.types.IR_IF_BREAK) {
      const group = groupStack[groupStack.length - 1] || {}
      queue.push(group.shouldBreak ? cmd.ifBreak : cmd.ifNotBreak)
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
    } else if (cmd.type === IRC.types.IR_FORCE_BREAK) {
    } else {
      // @ts-expect-error
      throw new Error(`unhandled, ${String(cmd.type)}`)
    }
  }
  return out.join('')
}

const formatDiff = (diff: Structured) => {
  const ir = diffToIR(diff)
  if (typeof ir === 'object' && 'received' in ir) {
    return `Expected: ${IRToString(ir.expected)}
Received: ${IRToString(ir.received)}`
  }
  return IRToString(ir)
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

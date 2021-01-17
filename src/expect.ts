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
              key: 'hi',
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
              IRC.line,
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

const printWidth = 80
const indentWidth = 2

const IRToString = (
  ir: IR,
  indent: number,
  parentBroken: boolean,
  remainingWidth: number,
): {
  breakParent: boolean
  str: string
  markers?: [lineNo: number, marker: Marker][]
  width: number
} => {
  if (typeof ir === 'string') {
    return {
      breakParent: ir.length > remainingWidth,
      str: ir,
      width: ir.length,
    }
  }
  if (Array.isArray(ir)) {
    let width = 0
    let str = ''
    let breakParent = false
    for (const c of ir) {
      const s = IRToString(
        c,
        indent + indentWidth,
        parentBroken,
        remainingWidth - width,
      )
      width += s.width
      str += s.str
      if (s.breakParent) breakParent = true
    }
    return {
      str,
      width,
      breakParent,
      markers: [], // TODO: handle markers
    }
  }
  if (ir.type === IRC.types.IR_TEXT)
    return {
      breakParent: ir.width > remainingWidth,
      str: ir.text,
      // marker on first line
      markers: ir.marker ? [[0, ir.marker]] : [],
      width: ir.width,
    }
  if (ir.type === IRC.types.IR_GROUP) {
    let out = ''
    let i = 0
    let groupWidth = 0
    while (i < ir.children.length) {
      const child = ir.children[i]
      const childRes = IRToString(
        child,
        indent,
        ir.shouldBreak || false,
        remainingWidth - groupWidth,
      )
      if (childRes.breakParent && !ir.shouldBreak) {
        // child forces this group to break, re-print the previous childs that thought it was not broken
        ir.shouldBreak = true
        i = 0
        out = ''
        groupWidth = 0
        continue
      }
      out += childRes.str
      groupWidth += childRes.width
      i++
    }
    return {
      str: out,
      breakParent: ir.shouldBreak || false,
      markers: [], // TODO: handle markers
      width: groupWidth,
    }
  }
  if (ir.type === IRC.types.IR_LINE)
    return {
      breakParent: true,
      // TODO: the indent there is not working
      str: '\n' + ' '.repeat(indent),
      width: remainingWidth - printWidth, // Reset the parent's width if a newline is printed
    }
  if (ir.type === IRC.types.IR_IF_BREAK)
    return IRToString(
      parentBroken ? ir.ifBreak : ir.ifNotBreak,
      indent,
      parentBroken,
      remainingWidth,
    )

  if (ir.type === IRC.types.IR_INDENT) {
    let width = indentWidth
    let str = ' '.repeat(indentWidth)
    let breakParent = false
    for (const c of ir.children) {
      const s = IRToString(
        c,
        indent + indentWidth,
        parentBroken,
        remainingWidth - width,
      )
      width += s.width
      str += s.str
      if (s.breakParent) breakParent = true
    }
    return {
      str,
      width,
      breakParent,
      markers: [], // TODO: handle markers
    }
  }
  return { str: String(ir), breakParent: false, width: String(ir).length }
}

const formatDiff = (diff: StructuredObject) => {
  return IRToString(diffToIR(diff), 0, false, printWidth).str
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

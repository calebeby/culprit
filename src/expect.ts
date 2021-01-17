import * as colors from 'kolorist'

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
            expected: 'hi',
            received: 'no',
          },
        },
      },
      {
        key: 'asdf',
        value: {
          expected: NOT_EXIST,
          received: { type: 'String', value: 'no' },
        },
      },
      {
        key: 'asdf2',
        value: {
          expected: { type: 'String', value: 'no' },
          received: NOT_EXIST,
        },
      },
      {
        key: 'asdf-3',
        value: {
          type: 'String',
          value: 'no',
        },
      },
    ],
  }
}

type IR =
  | string
  | IRCommands.Group
  | IRCommands.Text
  | IRCommands.LineOrSpace
  | IRCommands.IfBreak
  | IRCommands.Indent
  | IRCommands.Dedent

// "Intermediate Representation"
// This is used for determining when to break things onto multiple lines
// Idea is from Prettier: https://prettier.io/docs/en/technical-details.html
// More details: https://github.com/prettier/prettier/blob/master/commands.md
namespace IRCommands {
  export interface Group {
    type: typeof IR_GROUP
    marker?: Marker
    children: IR[]
    shouldBreak?: boolean | undefined
  }
  export interface Text {
    type: typeof IR_TEXT
    marker?: Marker
    text: string
    width: number
  }
  export interface LineOrSpace {
    type: typeof IR_LINE_OR_SPACE
  }
  export interface IfBreak {
    type: typeof IR_IF_BREAK
    ifBreak: IR
    ifNotBreak: IR
  }
  export interface Indent {
    type: typeof IR_INDENT
    children: IR[]
  }
  export interface Dedent {
    type: typeof IR_DEDENT
    children: IR[]
  }
}

// this is naiive it doesn't handle reserved words or unicode
const IDENTIFIER_REGEX = /^[$A-Z_][0-9A-Z_$]*$/i

type Marker = '+' | '-'

const IR_TEXT = Symbol('text')
const IR_GROUP = Symbol('group')
const IR_LINE_OR_SPACE = Symbol('lineOrSpace')
const IR_IF_BREAK = Symbol('ifBreak')
const IR_INDENT = Symbol('indent')
const IR_DEDENT = Symbol('dedent')

/** Intermediate Representation Commands */
const IRC = {
  /**
   * You can also just use a string directly,
   * this is only if you need to override the string width (i.e. to ignore ANSI escapes)
   * or to add a marker
   */
  text(text: string, width = text.length, marker?: Marker): IRCommands.Text {
    return { type: IR_TEXT, text, marker, width }
  },
  group(children: IR[], marker?: Marker): IRCommands.Group {
    const shouldBreak =
      children.some((c) => {
        if (typeof c === 'string') return false
        if (c.type === IR_TEXT && c.marker) return true
        if (c.type === IR_GROUP && (c.shouldBreak || c.marker)) return true
        return false
      }) || undefined
    return { type: IR_GROUP, children, shouldBreak, marker }
  },
  /** Prints a newline if the group breaks, or a space if the group doesn't */
  lineOrSpace: {
    type: IR_LINE_OR_SPACE,
  } as IRCommands.LineOrSpace,
  ifBreak(ifBreak: IR, ifNotBreak: IR = ''): IRCommands.IfBreak {
    return { type: IR_IF_BREAK, ifBreak, ifNotBreak }
  },
  indent(children: IR[]): IRCommands.Indent {
    return { type: IR_INDENT, children }
  },
  dedent(children: IR[]): IRCommands.Dedent {
    return { type: IR_DEDENT, children }
  },
}

const diffPropertyToIR = (prop: { key: string; value: Diff<Structured> }) => {
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
  if (typeof valueIR === 'object' && valueIR.type === IR_GROUP) {
    propertyIR.push(' ', valueIR)
  } else {
    propertyIR.push(
      IRC.lineOrSpace,
      IRC.ifBreak(IRC.indent([valueIR]), valueIR),
    )
  }
  return IRC.group(propertyIR)
}

const diffToIR = (diff: Diff<Structured>): IR => {
  if ('type' in diff) {
    if (diff.type === 'Object') {
      const objectIR: IR[] = ['{', IRC.lineOrSpace]
      for (const prop of diff.properties) {
        // the values are the same type, so the key will be printed only once
        if ('type' in prop.value) {
          objectIR.push(diffPropertyToIR(prop))
        } else {
          // The values are different types, so the key will be printed twice:
          // property: [ ... ]
          // property: "asdf"
          const { expected, received } = prop.value
          if (expected !== NOT_EXIST)
            objectIR.push(diffPropertyToIR({ key: prop.key, value: expected }))
          if (received !== NOT_EXIST)
            objectIR.push(diffPropertyToIR({ key: prop.key, value: received }))
        }
        objectIR.push(',', IRC.lineOrSpace)
      }
      return IRC.group(objectIR.concat('}'))
    }
    if (diff.type === 'String') {
      if (typeof diff.value === 'string') return '"' + diff.value + '"'
      const out: IR[] = []
      if (diff.value.expected !== NOT_EXIST)
        out.push('"' + expectedColor(diff.value.expected) + '"')
      if (diff.value.received !== NOT_EXIST)
        out.push('"' + receivedColor(diff.value.received) + '"')
      return IRC.group(out)
    }
    return 'Toad'
  } else {
    // TODO
  }
  return 'TOODOOO'
}

const printWidth = 70
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
  if (typeof ir === 'string')
    return {
      breakParent: ir.length > remainingWidth,
      str: ir,
      width: ir.length,
    }
  if (ir.type === IR_TEXT)
    return {
      breakParent: ir.width > remainingWidth,
      str: ir.text,
      // marker on first line
      markers: ir.marker ? [[0, ir.marker]] : [],
      width: ir.width,
    }
  if (ir.type === IR_GROUP) {
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
  if (ir.type === IR_LINE_OR_SPACE)
    return {
      breakParent: remainingWidth === 1,
      // TODO: the indent there is not working
      str: parentBroken ? '\n' + ' '.repeat(indent) : ' ',
      width: parentBroken ? remainingWidth - printWidth : 1, // Reset the parent's width if a newline is printed
    }
  if (ir.type === IR_IF_BREAK)
    return IRToString(
      parentBroken ? ir.ifBreak : ir.ifNotBreak,
      indent,
      parentBroken,
      remainingWidth,
    )

  if (ir.type === IR_INDENT) {
    let width = 0
    let str = ''
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
      return s
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

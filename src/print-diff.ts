import * as colors from 'kolorist'
import * as IRC from './irc'
import type { IR, Marker } from './irc'
import { Diff, NOT_EXIST, Structured } from './expect'

export const expectedColor = <T extends any>(input: T) => {
  if (typeof input === 'string') return colors.green(input)
  return [expOpen, input, expClose]
}

export const receivedColor = <T extends any>(input: T) => {
  if (typeof input === 'string') return colors.red(input)
  return [recOpen, input, recClose]
}

export const dimColor = <T extends any>(input: T) => {
  if (typeof input === 'string') return colors.gray(input)
  return [dimOpen, input, dimClose]
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

const [dimOpen, dimClose] = colors
  .gray(delim)
  .split(delim)
  .map((c) => IRC.text(c, 0))

const toString = (input: number | string | boolean | null | undefined) => {
  if (Object.is(input, -0)) return '-0'
  return String(input)
}

const expectedMarker = IRC.text('', 0, '-')
const receivedMarker = IRC.text('', 0, '+')

const propertyToIR = (
  key: string,
  value: Diff<Structured, typeof NOT_EXIST>,
): IR => {
  if ('expected' in value) {
    if (value.expected === NOT_EXIST && value.received !== NOT_EXIST)
      return [
        receivedMarker,
        receivedColor(propertyToIR(key, value.received)),
        IRC.forceBreak,
      ]
    if (value.received === NOT_EXIST && value.expected !== NOT_EXIST)
      return [
        expectedMarker,
        expectedColor(propertyToIR(key, value.expected)),
        IRC.forceBreak,
      ]
    if (value.expected === NOT_EXIST && value.received === NOT_EXIST) return []
  }
  const keyStr = (PROP_REGEX.test(key) ? key : JSON.stringify(key)) + ':'
  const valueIR = diffToIR(value as Diff<Structured>)
  if (typeof valueIR === 'object' && 'expected' in valueIR) {
    return [
      IRC.forceBreak, // force the parent to break regardless because even in the "unbroken" state this takes up multiple lines
      IRC.group([
        keyStr,
        IRC.indent([
          IRC.ifBreak(IRC.line, ' '),
          expectedMarker,
          valueIR.expected,
        ]),
        dimColor(','),
        IRC.ifBreak(
          IRC.indent([IRC.line, receivedMarker, valueIR.received]), // don't print the key a 2nd time
          [
            IRC.lineNonBreaking,
            keyStr,
            IRC.indent([' ', receivedMarker, valueIR.received]),
          ],
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
      let prop: typeof diff.properties[0]
      for (prop of diff.properties) {
        const comma = dimColor(prop === lastProp ? IRC.ifBreak(',', '') : ',')
        objectIR.push(
          IRC.lineOrSpace,
          propertyToIR(prop.key, prop.value),
          comma,
        )
      }
      return IRC.group([
        dimColor('{'),
        IRC.ifBreak(IRC.indent(objectIR), objectIR),
        IRC.lineOrSpace,
        dimColor('}'),
      ])
    }
    if (diff.type === 'Primitive') {
      if (typeof diff.value === 'object' && diff.value !== null) {
        if (typeof diff.value.expected === 'string') {
          const { expected, received } = diff.value
          return {
            expected: '"' + expectedColor(expected) + '"',
            received: '"' + receivedColor(received) + '"',
          }
        }
        return {
          expected: expectedColor(toString(diff.value.expected)),
          received: receivedColor(toString(diff.value.received)),
        }
      }
      if (typeof diff.value === 'string') return '"' + diff.value + '"'
      return toString(diff.value)
    }
    throw new Error(`diffToIR failed on ${JSON.stringify(diff)}`)
  }
  return {
    expected: expectedColor(diffToIR(diff.expected)),
    received: receivedColor(diffToIR(diff.received)),
  }
}

// this is naiive it doesn't handle reserved words or unicode
const PROP_REGEX = /^(?:[$A-Z_][0-9A-Z_$]*|[0-9]+\.?[0-9]*)$/i

const isGroup = (ir: IR): ir is IRC.Group => {
  while (Array.isArray(ir)) {
    if (ir.length !== 1) return false
    ir = ir[0]
  }
  if (typeof ir === 'string') return false
  return 'type' in ir && ir.type === IRC.types.IR_GROUP
}

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

const printWidth = 80
const indentWidth = 2

const POP_GROUP_STACK = Symbol('POP_GROUP_STACK')

const IRToString = (ir: IR, printMarkers = true) => {
  // the queue holds next-to-handle items at the end
  // (so it is in reverse of the actual output)
  const queue: (IR | typeof POP_GROUP_STACK)[] = [ir]
  let cmd: IR | typeof POP_GROUP_STACK | undefined
  let out: string[] = []
  let lineCount = 0
  const markers: { [lineNo: number]: Marker } = {}
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
      if (printMarkers && cmd.marker) {
        markers[lineCount] = cmd.marker
      }
      out.push(cmd.text)
      pos += cmd.width
    } else if (cmd.type === IRC.types.IR_GROUP) {
      groupStack.push(cmd)
      const remainingSpaceInLine = printWidth - (printMarkers ? 2 : 0) - pos
      const needsToBreak =
        cmd.shouldBreak || !fits(cmd.children, remainingSpaceInLine)
      // queue is backwards
      queue.push(POP_GROUP_STACK, ...cmd.children.slice().reverse())
      cmd.shouldBreak = needsToBreak
    } else if (
      cmd.type === IRC.types.IR_LINE ||
      cmd.type === IRC.types.IR_LINE_NON_BREAKING
    ) {
      lineCount++
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
  lineCount = 0
  const fullString = out.join('')
  if (printMarkers) {
    return fullString
      .split('\n')
      .map((line, i) => {
        const m = markers[i]
          ? markers[i] === '-'
            ? expectedColor('- ')
            : receivedColor('+ ')
          : '  '
        return m + line
      })
      .join('\n')
  }
  return fullString
}

export const formatDiff = (diff: Diff<Structured>) => {
  const ir = diffToIR(diff)
  if (typeof ir === 'object' && 'received' in ir) {
    return IRToString(
      [
        IRC.group([
          'Expected:',
          IRC.ifBreak(IRC.indent([IRC.line, ir.expected, IRC.line]), [
            ' ',
            ir.expected,
          ]),
        ]),
        IRC.line,
        IRC.group([
          'Received:',
          IRC.ifBreak(IRC.indent([IRC.line, ir.received]), [' ', ir.received]),
        ]),
      ],
      false,
    )
  }
  return (
    expectedColor('- Expected') +
    '\n' +
    receivedColor('+ Received') +
    '\n\n' +
    IRToString(ir)
  )
}

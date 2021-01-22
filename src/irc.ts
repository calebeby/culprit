// "Intermediate Representation"
// This is used for determining when to break things onto multiple lines
// Idea is from Prettier: https://prettier.io/docs/en/technical-details.html
// More details: https://github.com/prettier/prettier/blob/master/commands.md

export type IR =
  | string
  | Group
  | Text
  | Line
  | IfBreak
  | Indent
  | Dedent
  | LineNonBreaking
  | ForceBreak
  | IR[]
  | { expected: IR; received: IR }

export type Marker = '+' | '-'

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
export interface Line {
  type: typeof IR_LINE
}
export interface LineNonBreaking {
  type: typeof IR_LINE_NON_BREAKING
}
export interface ForceBreak {
  type: typeof IR_FORCE_BREAK
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
}

const IR_TEXT = Symbol('text')
const IR_GROUP = Symbol('group')
const IR_LINE = Symbol('line')
const IR_LINE_NON_BREAKING = Symbol('lineNonBreaking')
const IR_FORCE_BREAK = Symbol('break')
const IR_IF_BREAK = Symbol('ifBreak')
const IR_INDENT = Symbol('indent')
const IR_DEDENT = Symbol('dedent')

export const types = {
  IR_TEXT,
  IR_GROUP,
  IR_LINE,
  IR_IF_BREAK,
  IR_LINE_NON_BREAKING,
  IR_FORCE_BREAK,
  IR_INDENT,
  IR_DEDENT,
} as const

/**
 * You can also just use a string directly,
 * this is only if you need to override the string width (i.e. to ignore ANSI escapes)
 * or to add a marker
 */
export const text = (
  text: string,
  width = text.length,
  marker?: Marker,
): Text => {
  return { type: IR_TEXT, text, marker, width }
}

export const group = (
  children: IR[],
  { marker }: { marker?: Marker } = {},
): Group => {
  const childIsBroken = (c: IR) => {
    if (typeof c === 'string') return false
    if (Array.isArray(c)) return c.some(childIsBroken)
    if ('expected' in c) return true
    if (c.type === IR_TEXT && c.marker) return true
    if (c.type === IR_GROUP && (c.shouldBreak || c.marker)) return true
    return false
  }
  const shouldBreak = children.some(childIsBroken) || undefined
  const groupObj: Group = { type: IR_GROUP, children, shouldBreak, marker }
  return groupObj
}
export const ifBreak = (ifBreak: IR, ifNotBreak: IR = ''): IfBreak => {
  return { type: IR_IF_BREAK, ifBreak, ifNotBreak }
}
export const indent = (children: IR[]): Indent => {
  return { type: IR_INDENT, children }
}
export const dedent: Dedent = { type: IR_DEDENT }

/** A newline character that preserves indent and forces the parent to break */
export const line: Line = { type: IR_LINE }
/** A newline character that preserves indent and does not break the parent */
export const lineNonBreaking: LineNonBreaking = { type: IR_LINE_NON_BREAKING }
/** Forces the parent to break (does not print anything) */
export const forceBreak: ForceBreak = { type: IR_FORCE_BREAK }
/** Prints a newline if the group breaks, or a space if the group doesn't */
export const lineOrSpace = ifBreak(line, ' ')

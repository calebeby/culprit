// "Intermediate Representation"
// This is used for determining when to break things onto multiple lines
// Idea is from Prettier: https://prettier.io/docs/en/technical-details.html
// More details: https://github.com/prettier/prettier/blob/master/commands.md

export type IR = string | Group | Text | Line | IfBreak | Indent | Dedent | IR[]

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

const IR_TEXT = Symbol('text')
const IR_GROUP = Symbol('group')
const IR_LINE = Symbol('line')
const IR_IF_BREAK = Symbol('ifBreak')
const IR_INDENT = Symbol('indent')
const IR_DEDENT = Symbol('dedent')

export const types = {
  IR_TEXT,
  IR_GROUP,
  IR_LINE,
  IR_IF_BREAK,
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
export const group = (children: IR[], marker?: Marker): Group => {
  const shouldBreak =
    children.some((c) => {
      if (typeof c === 'string') return false
      if (c.type === IR_TEXT && c.marker) return true
      if (c.type === IR_GROUP && (c.shouldBreak || c.marker)) return true
      return false
    }) || undefined
  return { type: IR_GROUP, children, shouldBreak, marker }
}
export const ifBreak = (ifBreak: IR, ifNotBreak: IR = ''): IfBreak => {
  return { type: IR_IF_BREAK, ifBreak, ifNotBreak }
}
export const indent = (children: IR[]): Indent => {
  return { type: IR_INDENT, children }
}
export const dedent = (children: IR[]): Dedent => {
  return { type: IR_DEDENT, children }
}

export const line: Line = { type: IR_LINE }

/** Prints a newline if the group breaks, or a space if the group doesn't */
export const lineOrSpace = ifBreak(line, ' ')

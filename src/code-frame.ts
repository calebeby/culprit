// This is from https://github.com/marvinhagemeister/simple-code-frame/blob/master/src/index.ts
// But it has added colors

import * as colors from 'kolorist'

/**
 * Convert tabs indentation to two spaces.
 */
function tabs2Spaces(str: string) {
  return str.replace(/^\t+/, (tabs) => '  '.repeat(tabs.length))
}

export interface Options {
  before?: number
  after?: number
}

/**
 * Generate an excerpt of the location in the source around the
 * specified position.
 */
export function createCodeFrame(
  text: string,
  lineNum: number,
  columnNum: number,
  { before = 3, after = 3 }: Options = {},
) {
  const lines = text.split('\n')

  const start = Math.max(0, lineNum - before)
  const end = Math.min(lines.length, lineNum + after + 1)

  const maxChars = String(end).length
  const padding = ' '.repeat(maxChars)

  let out = ''

  const leftMarker = colors.bold(colors.red('>'))
  const underMarker = colors.bold(colors.red('^'))
  const pipe = colors.gray(' | ')

  for (let i = start; i < end; i++) {
    const line = lines[i]
    const currentLine = (padding + (i + 1)).slice(-maxChars)

    const normalized = tabs2Spaces(lines[i])
    if (i === lineNum) {
      out += `${leftMarker} ${colors.gray(currentLine)}${pipe}${normalized}\n`

      // Account for possible tab indention
      const count = Math.max(0, normalized.length - line.length + columnNum)

      out += `  ${padding}${pipe}${' '.repeat(count)}${underMarker}\n`
    } else {
      out += `  ${colors.gray(currentLine)}${pipe}${normalized}\n`
    }
  }

  return out
}

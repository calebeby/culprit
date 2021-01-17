#!/usr/bin/env node

import path from 'path'
import tinyGlob from 'tiny-glob'
import * as colors from 'kolorist'
import { parseStackTrace } from 'errorstacks'
import { promises as fs } from 'fs'
import { createCodeFrame } from './code-frame'
import { fileURLToPath } from 'url'
import expectGlobal from './expect'

interface Test {
  name: string
  fn: () => void
}

interface TestSuite {
  file: string
  tests: Test[]
}

const main = async () => {
  const cwd = process.cwd()
  const thisFile = import.meta.url
  const testFiles = await tinyGlob('**/tests/**.{j,t}s')
  const testSuites = new Map<string, TestSuite>(
    testFiles.map((file) => [file, { file, tests: [] }]),
  )
  await Promise.all(
    testFiles.map(async (file) => {
      global.expect = expectGlobal
      global.test = (name: string, fn: () => void) => {
        testSuites.get(file).tests.push({ name, fn })
      }
      try {
        await import(path.join(cwd, file))
      } catch (e) {
        console.log('error', e)
      }
    }),
  )

  let hasFail = false

  await Promise.all(
    [...testSuites.values()].map(async ({ file, tests }) => {
      await Promise.all(
        tests.map(async (test) => {
          try {
            test.fn()
          } catch (e) {
            hasFail = true
            let errMsg: string = e.message + '\n'
            const parsedStack = parseStackTrace(e.stack)
            const idxOfStackInThisFile = parsedStack.findIndex(
              (s) => s.fileName === thisFile,
            )
            const stackSubset =
              idxOfStackInThisFile !== -1
                ? parsedStack.slice(0, idxOfStackInThisFile)
                : parsedStack
            const loc = stackSubset[0]
            if (loc) {
              const frame = createCodeFrame(
                await fs.readFile(file, 'utf8'),
                loc.line - 1,
                loc.column - 1,
              )
              errMsg += '\n' + frame + '\n'
            }
            errMsg += stackSubset
              .map(
                (s) =>
                  `at ${s.name} (${colors.cyan(
                    path.relative(cwd, fileURLToPath(s.fileName)),
                  )}:${s.line}:${s.column})`,
              )
              .join('\n')
            console.error(colors.bold(colors.red(`  ● ${test.name}`)) + '\n')
            console.error(
              errMsg
                .split('\n')
                .map((t) => '    ' + t)
                .join('\n'),
            )
          }
        }),
      )
    }),
  )

  if (hasFail) process.exit(1)
}

main()

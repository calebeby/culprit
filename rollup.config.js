import babel from '@rollup/plugin-babel'
import hashbang from 'rollup-plugin-hashbang'
import nodeResolve from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import prettier from 'rollup-plugin-prettier'
import * as t from '@babel/types'

/** @type {import('@babel/core').PluginObj} */
const constToLet = {
  name: 'const-to-let',
  visitor: {
    VariableDeclaration({ node }) {
      if (node.kind === 'const') {
        node.kind = 'let'
      }
    },
  },
}

// stip out some of kolorist's checks to make sure it is not a browser
/** @type {import('@babel/core').PluginObj} */
const globalTypes = {
  name: 'global-types',
  visitor: {
    UnaryExpression(path) {
      const { node } = path
      if (node.operator !== 'typeof') return
      const arg = node.argument
      if (
        t.isIdentifier(arg, { name: 'self' }) ||
        t.isIdentifier(arg, { name: 'window' })
      ) {
        path.replaceWith(t.stringLiteral('undefined'))
      }
      if (t.isIdentifier(arg, { name: 'global' })) {
        path.replaceWith(t.stringLiteral('object'))
      }
    },
  },
}

// strip the symbol name (doesn't affect functionality): Symbol('asdf')
/** @type {import('@babel/core').PluginObj} */
const stripSymbolName = {
  name: 'strip-symbol-name',
  visitor: {
    CallExpression(path) {
      const { node } = path
      if (!t.isIdentifier(node.callee, { name: 'Symbol' })) return
      if (node.arguments.length !== 1 || !t.isStringLiteral(node.arguments[0]))
        return
      path.get('arguments.0').remove()
    },
  },
}

const extensions = ['.ts', '.tsx', '.js', '.mjs']

const isProd = process.env.NODE_ENV === 'production'
const debugProd = false

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'src/index.ts',
  plugins: [
    nodeResolve({ extensions }),
    hashbang(),
    babel({
      babelHelpers: 'bundled',
      extensions,
      presets: ['@babel/preset-typescript'],
      plugins: [
        'babel-plugin-un-cjs',
        isProd && constToLet,
        globalTypes,
        isProd && stripSymbolName,
      ].filter(Boolean),
    }),
    (isProd || debugProd) &&
      terser({
        ecma: 2020,
        mangle: !debugProd,
        compress: { unsafe: true, passes: 0 },
      }),
    debugProd && prettier({ parser: 'babel' }),
  ],
  output: {
    dir: 'dist',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
    sourcemap: true,
  },
}

export default config

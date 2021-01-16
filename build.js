import esbuild from 'esbuild'
import { builtinModules } from 'module'

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'node12.20.1',
  external: [...builtinModules, 'tiny-glob'],
  format: 'esm',
  outfile: 'dist/index.mjs',
})

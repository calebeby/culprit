# Differences from Jest

- Printing and diffing of values is unified
- Printing values and value diffs uses an heuristic similar to Prettier's
- `expect(...).toThrow(...)` does not require thrown or expected values to be `Error`s
- `expect(...).toThrow(...)` returns the thrown value, so additional assertions can be performed:
  ```js
  const thrown = expect(() => throw new Error('msg')).toThrow()
  expect(thrown.message).toEqual(msg)
  ```

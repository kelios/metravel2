const fs = require('fs')
const path = require('path')

const findMissingRepositoryPaths = (files) => {
  return files.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)))
}

const expectTargetedTestsListUnique = (files) => {
  const unique = new Set(files)
  expect(unique.size).toBe(files.length)
}

const expectTargetedTestsListResolvable = (files) => {
  expect(findMissingRepositoryPaths(files)).toEqual([])
}

module.exports = {
  findMissingRepositoryPaths,
  expectTargetedTestsListUnique,
  expectTargetedTestsListResolvable,
}

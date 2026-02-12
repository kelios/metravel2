const { isPlaceholderValue } = require('./validation-utils')

const isConcreteValue = (value) => {
  return !isPlaceholderValue(value)
}

const isHttpUrl = (value) => {
  if (!isConcreteValue(value)) return false
  return /^https?:\/\/\S+$/i.test(String(value).trim())
}

module.exports = {
  isConcreteValue,
  isHttpUrl,
}

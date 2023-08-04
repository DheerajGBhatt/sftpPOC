module.exports = {
  collectCoverage: true,
  coverageReporters: ["clover", "json", "html"],
  coverageThreshold: {
    global: {
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
}

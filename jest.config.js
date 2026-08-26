module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/modules/matching/**/*.js',
    'src/modules/ranking/**/*.js',
    'src/shared/**/*.js',
    'src/utils/**/*.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};

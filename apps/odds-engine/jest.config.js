/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  // L'odds-engine n'héberge que le câblage du moteur de cotes (la logique
  // testée vit dans `@betnext/odds`). Pas de spec ici → ne casse pas la CI.
  passWithNoTests: true,
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
};

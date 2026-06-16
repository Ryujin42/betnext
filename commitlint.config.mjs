/**
 * Convention de messages de commit : Conventional Commits.
 * Format : <type>(<scope>): <sujet>
 *   ex. feat(api-gateway): ajoute le endpoint /health
 *       chore(lot-0): met en place ESLint + Prettier
 *
 * Le scope est libre (nom de service/lib ou `lot-N`).
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};

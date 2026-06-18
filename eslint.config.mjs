// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Configuration ESLint racine (flat config, ESLint 9) partagée par tout le
 * monorepo. Les règles "type-aware" ne sont volontairement pas activées ici
 * pour que `pnpm lint` reste fonctionnel y compris sur un repo vide et sans
 * dépendre d'un `tsconfig` par projet. Chaque app/lib peut affiner ses règles.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.nx/**',
      '**/.expo/**',
      '**/.vite/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Convention non négociable : zéro `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    /*
     * Apps NestJS : `emitDecoratorMetadata` rend les classes utilisées en
     * annotation de paramètre runtime-only (DI, class-validator). La règle
     * `consistent-type-imports` les convertirait à tort en `import type`,
     * cassant l'injection. On la désactive sur ces dossiers.
     */
    files: [
      'apps/api-gateway/**/*.ts',
      'apps/user-service/**/*.ts',
      'apps/event-service/**/*.ts',
      'apps/betting-service/**/*.ts',
      'apps/odds-engine/**/*.ts',
      'apps/wallet-service/**/*.ts',
      'apps/notification/**/*.ts',
      'apps/audit-service/**/*.ts',
      'libs/odds/**/*.ts',
      'libs/observability/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  eslintConfigPrettier,
);

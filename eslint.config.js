// ESLint flat config. Correctness rules are errors; size and complexity rules are warnings —
// they are the Cleanup Agent's to-do list, not a build blocker. Formatting belongs to Prettier.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import sonarjs from 'eslint-plugin-sonarjs'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const MAX_NESTING_DEPTH = 3
const MAX_FUNCTION_LINES = 40
const MAX_COGNITIVE_COMPLEXITY = 15

const importGroups = [
  ['^\\u0000'], // side-effect imports (CSS, fonts)
  ['^node:'],
  ['^react', '^react-dom', '^react-router'],
  ['^@?\\w'], // other third-party packages
  ['^#core/'],
  ['^@/', '^@test/'],
  ['^\\.\\./', '^\\./'],
]

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage', 'plan', 'data*', '.playwright-mcp', '.claude'] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': ['error', { groups: importGroups }],
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, typedefs: false }],
      // `void promise` is how a deliberately unawaited promise is marked for no-floating-promises.
      'sonarjs/void-use': 'off',
      // A leading underscore marks a value that is deliberately unused (e.g. destructured to omit it).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'sonarjs/no-unused-vars': 'off',
      // React Hook Form's handleSubmit returns a promise; JSX handlers may return one.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

      // Readability: the Cleanup Agent's to-do list.
      'id-length': ['warn', { min: 2, exceptions: ['i', 'j', '_'], properties: 'never' }],
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/prefer-read-only-props': 'warn',
      // Regexes here run on the user's own short Markdown lines, not on hostile input.
      'sonarjs/super-linear-regex': 'warn',
      'max-depth': ['warn', MAX_NESTING_DEPTH],
      'max-lines-per-function': ['warn', { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true }],
      'sonarjs/cognitive-complexity': ['warn', MAX_COGNITIVE_COMPLEXITY],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/**/*.tsx'],
    ...reactRefresh.configs.vite,
    // Only affects hot reload during development.
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },

  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { ...tseslint.configs.disableTypeChecked.languageOptions, globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'test/**', 'e2e/**'],
    // Tests read untyped JSON responses and use long describe blocks.
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Tests talk to a local backend over ws:// and use the OS temp folder on purpose.
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/publicly-writable-directories': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'sonarjs/no-alphabetical-sort': 'off',
    },
  },

  prettier,
)

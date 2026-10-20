import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // File bảng route xuất JSX nên không áp dụng Fast Refresh
    files: ['src/routes/*Routes.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // MainLayout đã render thẻ main duy nhất
    files: ['src/pages/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='main']",
          message: '<main> is rendered once by MainLayout. Use <div> or <section> inside pages (a page must have a single <main> landmark).',
        },
      ],
    },
  }
);

import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    lib: {
      entry: 'electron/main.cjs',
      formats: ['cjs'],
      fileName: () => '[name].cjs',
    },
    rollupOptions: {
      external: ['pg-native', 'kerberos', '@mongodb-js/zstd', 'snappy', 'aws4', '@aws-sdk/credential-providers', 'gcp-metadata', 'mongodb-client-encryption'],
    },
  },
});

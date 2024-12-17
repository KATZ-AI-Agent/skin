import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    '@napi-rs/canvas',
    'canvas',
    'node-telegram-bot-api',
    '@solana/web3.js',
    'mongodb'
  ]
});
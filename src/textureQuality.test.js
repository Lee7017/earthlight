import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIEW_TEXTURE_WIDTH,
  ORBIT_TEXTURE_WIDTH,
  preferredTextureWidth,
  textureLoadingStages,
} from './textureQuality.js';

test('every normal device starts with a tiny 512px Earth preview', () => {
  assert.equal(PREVIEW_TEXTURE_WIDTH, 512);
  assert.equal(ORBIT_TEXTURE_WIDTH, 2048);
  assert.deepEqual(textureLoadingStages(2048), [512, 2048]);
  assert.deepEqual(textureLoadingStages(4096), [512, 2048, 4096]);
  assert.deepEqual(textureLoadingStages(8192), [512, 2048, 8192]);
});

test('loading stages never fetch a size exceeding the device limit', () => {
  assert.deepEqual(textureLoadingStages(8192, 4096), [512, 2048, 4096]);
  assert.deepEqual(textureLoadingStages(2048, 2048), [512, 2048]);
  assert.deepEqual(textureLoadingStages(512, 2048), [512]);
});

test('phones prefer 2K once the preview is visible', () => {
  assert.equal(preferredTextureWidth({ viewportWidth: 390 }), 2048);
  assert.equal(preferredTextureWidth({ viewportWidth: 430, deviceMemory: 2 }), 2048);
});

test('high-memory desktop devices can upgrade to 8K', () => {
  assert.equal(preferredTextureWidth({ viewportWidth: 1600, deviceMemory: 8, maxTextureSize: 8192 }), 8192);
  assert.equal(preferredTextureWidth({ viewportWidth: 1280, deviceMemory: 8, maxTextureSize: 8192 }), 4096);
  assert.equal(preferredTextureWidth({ viewportWidth: 1600, deviceMemory: 4, maxTextureSize: 8192 }), 4096);
});

test('data saver or slow connectivity skips costly background upgrades', () => {
  assert.equal(preferredTextureWidth({ saveData: true }), 512);
  assert.equal(preferredTextureWidth({ effectiveType: 'slow-2g' }), 512);
  assert.equal(preferredTextureWidth({ effectiveType: '2g' }), 512);
  assert.equal(preferredTextureWidth({ effectiveType: '3g' }), 2048);
});

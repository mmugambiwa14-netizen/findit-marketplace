import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const uploader = await read('src/components/tours/TourUploader.jsx');
const cameraDialog = await read('src/components/permissions/CameraPermissionDialog.jsx');
const locationSelector = await read('src/components/location/LocationSelector.jsx');
const locationDialog = await read('src/components/location/LocationPermissionDialog.jsx');
const pushSettings = await read('src/components/settings/PushNotificationSettings.jsx');

test('camera access is initiated only from the Record action', () => {
  assert.match(uploader, /onClick=\{openCamera\}/);
  assert.match(uploader, /recordInputRef\.current\?\.click\(\)/);
  assert.match(uploader, /capture="environment"/);
  assert.doesNotMatch(uploader, /useEffect[\s\S]{0,300}recordInputRef\.current\?\.click/);
});

test('camera first-use explanation covers camera, microphone, local review and cancellation', () => {
  assert.match(cameraDialog, /Use your camera to record a Peek/);
  assert.match(cameraDialog, /camera and microphone access/);
  assert.match(cameraDialog, /stays on your device until you review it/);
  assert.match(cameraDialog, /does not start the camera in the background/);
  assert.match(cameraDialog, /Not now/);
});

test('camera explanation is remembered without bypassing the browser permission boundary', () => {
  assert.match(uploader, /CAMERA_EXPLANATION_KEY/);
  assert.match(uploader, /readStoredString\('local'/);
  assert.match(uploader, /writeStoredString\('local'/);
  assert.doesNotMatch(uploader, /getUserMedia/);
});

test('location remains explanation-first and user initiated', () => {
  assert.match(locationSelector, /onClick=\{\(\) => setPermissionOpen\(true\)\}/);
  assert.match(locationSelector, /consentGranted: true/);
  assert.match(locationDialog, /Use your location once/);
  assert.doesNotMatch(locationSelector, /useEffect[\s\S]{0,300}resolveCurrentMarketplaceLocation/);
});

test('notification permission remains behind an explicit opt-in control', () => {
  assert.match(pushSettings, /enableWebPush/);
  assert.match(pushSettings, /onClick|onCheckedChange/);
  assert.doesNotMatch(pushSettings, /useEffect[\s\S]{0,300}enableWebPush/);
});

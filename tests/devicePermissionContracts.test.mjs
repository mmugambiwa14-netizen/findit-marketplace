import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const uploader = await read('src/components/tours/TourUploader.jsx');
const cameraDialog = await read('src/components/permissions/CameraPermissionDialog.jsx');
const locationSelector = await read('src/components/location/LocationSelector.jsx');
const locationDialog = await read('src/components/location/LocationPermissionDialog.jsx');
const pushSettings = await read('src/components/settings/PushNotificationSettings.jsx');

function effectBodies(source) {
  return [...source.matchAll(/useEffect\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*\)/g)]
    .map((match) => match[1])
    .join('\n');
}

test('camera access is initiated only from the Record action', () => {
  assert.match(uploader, /onClick=\{openCamera\}/);
  assert.match(uploader, /recordInputRef\.current\?\.click\(\)/);
  assert.match(uploader, /capture="environment"/);
  assert.doesNotMatch(effectBodies(uploader), /recordInputRef\.current\?\.click/);
});

test('camera first-use explanation covers camera, microphone, local review and cancellation', () => {
  assert.match(cameraDialog, /Use your camera to record a Peek/);
  assert.match(cameraDialog, /camera and microphone access/);
  assert.match(cameraDialog, /stays on your device until you review it/);
  assert.match(cameraDialog, /does not start the camera in the background/);
  assert.match(cameraDialog, /Not now/);
});

test('camera explanation is remembered without bypassing the browser permission boundary', () => {
  assert.match(uploader, /PERMISSION_KINDS\.CAMERA/);
  assert.match(uploader, /hasSeenPermissionIntro/);
  assert.match(uploader, /markPermissionIntroSeen/);
  assert.match(uploader, /readBrowserPermissionState/);
  assert.doesNotMatch(uploader, /getUserMedia/);
});

test('location remains explanation-first and user initiated', () => {
  assert.match(locationSelector, /onClick=\{\(\) => setPermissionOpen\(true\)\}/);
  assert.match(locationSelector, /consentGranted: true/);
  assert.match(locationDialog, /Use your location once/);
  assert.doesNotMatch(effectBodies(locationSelector), /resolveCurrentMarketplaceLocation/);
});

test('notification permission remains behind an explicit opt-in control', () => {
  assert.match(pushSettings, /const toggle = async/);
  assert.match(pushSettings, /await enableWebPush\(\)/);
  assert.match(pushSettings, /onClick=\{toggle\}/);
  assert.doesNotMatch(effectBodies(pushSettings), /enableWebPush/);
});

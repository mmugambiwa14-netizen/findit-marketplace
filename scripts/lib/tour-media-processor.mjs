import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createReadStream, createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const MAX_SOURCE_BYTES = 262_144_000;
const MAX_DURATION_SECONDS = 120;
const PROCESS_TIMEOUT_MS = 4 * 60 * 1000;
const CAPTURE_LIMIT = 16_384;

function commandName(name) {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  if (name === 'FINDIT_FFMPEG_PATH') return ffmpegStatic || 'ffmpeg';
  return ffprobeStatic?.path || 'ffprobe';
}

function boundedAppend(current, chunk) {
  return `${current}${chunk}`.slice(-CAPTURE_LIMIT);
}

export function runMediaCommand(command, args, { timeoutMs = PROCESS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} exceeded its processing timeout`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = boundedAppend(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk); });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim() || 'no diagnostic output'}`));
    });
  });
}

export async function assertMediaToolchain() {
  await runMediaCommand(commandName('FINDIT_FFMPEG_PATH'), ['-hide_banner', '-version'], { timeoutMs: 15_000 });
  await runMediaCommand(commandName('FINDIT_FFPROBE_PATH'), ['-hide_banner', '-version'], { timeoutMs: 15_000 });
}

async function downloadToFile(url, outputPath, maxBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`source download failed (${response.status})`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error('source download exceeds the configured limit');

  let received = 0;
  const limiter = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maxBytes) throw new Error('source download exceeds the configured limit');
      controller.enqueue(chunk);
    },
  });
  await pipeline(response.body.pipeThrough(limiter), createWriteStream(outputPath, { flags: 'wx' }));
  if (received < 1) throw new Error('source download was empty');
}

async function uploadFile(client, bucket, storagePath, localPath, contentType) {
  const file = await openAsBlob(localPath, { type: contentType });
  const result = await client.storage.from(bucket).upload(storagePath, file, {
    contentType,
    cacheControl: '300',
    upsert: true,
  });
  if (result.error) throw new Error(`derived upload failed: ${result.error.message}`);
}

async function sha256File(path) {
  const hash = crypto.createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function probeMedia(path) {
  const { stdout } = await runMediaCommand(commandName('FINDIT_FFPROBE_PATH'), [
    '-v', 'error',
    '-show_entries', 'format=duration,format_name:stream=codec_type,codec_name,width,height',
    '-of', 'json',
    path,
  ]);
  const parsed = JSON.parse(stdout);
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
  const audio = parsed.streams?.find((stream) => stream.codec_type === 'audio');
  const durationSeconds = Number(parsed.format?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);
  assert.ok(Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= MAX_DURATION_SECONDS, 'processed duration is invalid');
  assert.ok(Number.isInteger(width) && width > 0 && width <= 1280, 'processed width is invalid');
  assert.ok(Number.isInteger(height) && height > 0 && height <= 1280, 'processed height is invalid');
  assert.ok(Math.min(width, height) <= 720, 'processed short edge exceeds 720p');
  assert.equal(video?.codec_name, 'h264', 'processed video must use H.264');
  assert.ok(!audio || audio.codec_name === 'aac', 'processed audio must use AAC');
  assert.match(String(parsed.format?.format_name || ''), /(?:^|,)mp4(?:,|$)/, 'processed container must be MP4');
  return {
    durationSeconds,
    width,
    height,
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name ?? null,
  };
}

export async function transcodeTourMedia(sourcePath, playbackPath, thumbnailPath) {
  const scale = "scale=w='min(iw,if(gte(iw,ih),1280,720))':h='min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1";
  await runMediaCommand(commandName('FINDIT_FFMPEG_PATH'), [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-i', sourcePath,
    '-map', '0:v:0', '-map', '0:a?',
    '-vf', scale,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-map_metadata', '-1',
    '-t', String(MAX_DURATION_SECONDS),
    playbackPath,
  ]);
  const metadata = await probeMedia(playbackPath);
  await runMediaCommand(commandName('FINDIT_FFMPEG_PATH'), [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-ss', String(Math.min(1, Math.max(0, metadata.durationSeconds / 10))),
    '-i', playbackPath,
    '-frames:v', '1',
    '-vf', 'scale=640:640:force_original_aspect_ratio=decrease',
    '-c:v', 'libwebp', '-quality', '82',
    thumbnailPath,
  ]);
  return metadata;
}

export async function createSyntheticTourSource(outputPath, { durationSeconds = 2 } = {}) {
  await mkdir(dirname(outputPath), { recursive: true });
  await runMediaCommand(commandName('FINDIT_FFMPEG_PATH'), [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=24:duration=${durationSeconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${durationSeconds}`,
    '-shortest',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart',
    outputPath,
  ], { timeoutMs: 60_000 });
  return outputPath;
}

export async function processClaimedTour(client, candidate) {
  const workDirectory = await mkdtemp(join(tmpdir(), 'findit-tour-'));
  const sourcePath = join(workDirectory, 'source');
  const playbackPath = join(workDirectory, 'playback.mp4');
  const thumbnailPath = join(workDirectory, 'thumbnail.webp');
  try {
    const sourceResult = await client.storage
      .from(candidate.source_bucket)
      .createSignedUrl(candidate.source_storage_path, 300);
    if (sourceResult.error || !sourceResult.data?.signedUrl) {
      throw new Error(`source signing failed: ${sourceResult.error?.message || 'missing URL'}`);
    }
    await downloadToFile(sourceResult.data.signedUrl, sourcePath, MAX_SOURCE_BYTES);
    const metadata = await transcodeTourMedia(sourcePath, playbackPath, thumbnailPath);
    const playbackStats = await stat(playbackPath);
    const thumbnailStats = await stat(thumbnailPath);
    assert.ok(playbackStats.size > 0 && playbackStats.size <= MAX_SOURCE_BYTES, 'processed playback size is invalid');
    assert.ok(thumbnailStats.size > 0 && thumbnailStats.size <= 5_242_880, 'processed thumbnail size is invalid');

    await uploadFile(client, candidate.playback_bucket, candidate.playback_storage_path, playbackPath, 'video/mp4');
    await uploadFile(client, candidate.thumbnail_bucket, candidate.thumbnail_storage_path, thumbnailPath, 'image/webp');
    const checksum = await sha256File(playbackPath);
    const result = await client.rpc('finalize_tour_processing', {
      p_tour_id: candidate.tour_id,
      p_lease_token: candidate.lease_token,
      p_duration_seconds: metadata.durationSeconds,
      p_width: metadata.width,
      p_height: metadata.height,
      p_processed_byte_size: playbackStats.size,
      p_detected_container: 'mp4',
      p_detected_video_codec: metadata.videoCodec,
      p_detected_audio_codec: metadata.audioCodec,
      p_checksum_sha256: checksum,
    });
    if (result.error || result.data !== true) {
      throw new Error(`processing finalization failed: ${result.error?.message || 'stale lease'}`);
    }
    return { ...metadata, processedByteSize: playbackStats.size, thumbnailByteSize: thumbnailStats.size, checksum };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

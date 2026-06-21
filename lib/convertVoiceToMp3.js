"use strict";

/**
 * Convert a recorded voice Blob (webm/ogg/mp4) to MP3 in the browser.
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function convertVoiceBlobToMp3(blob) {
  if (typeof window === "undefined") {
    throw new Error("Voice conversion is only available in the browser.");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close();
  }

  const lamejs = await import("lamejs");
  const Mp3Encoder = lamejs.default?.Mp3Encoder ?? lamejs.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error("MP3 encoder is unavailable.");
  }

  const sampleRate = audioBuffer.sampleRate;
  const mono = mixToMono(audioBuffer);
  const samples = floatTo16BitPCM(mono);
  const mp3encoder = new Mp3Encoder(1, sampleRate, 128);
  const blockSize = 1152;
  const mp3Chunks = [];

  for (let offset = 0; offset < samples.length; offset += blockSize) {
    const chunk = samples.subarray(offset, offset + blockSize);
    const encoded = mp3encoder.encodeBuffer(chunk);
    if (encoded.length > 0) {
      mp3Chunks.push(encoded);
    }
  }

  const flushed = mp3encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(flushed);
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

/** @param {AudioBuffer} audioBuffer */
function mixToMono(audioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i += 1) {
    mono[i] = (left[i] + right[i]) / 2;
  }
  return mono;
}

/** @param {Float32Array} input */
function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_IMAGE_BYTES,
  MAX_VOICE_BYTES,
  MAX_VOICE_SECONDS,
  MAX_MEDIA_MB,
} from "../lib/reminderMedia";
import { convertVoiceBlobToMp3 } from "../lib/convertVoiceToMp3";

/**
 * Reminder message field with optional image upload and voice recording.
 */
export default function ReminderMessageInput({
  message,
  onMessageChange,
  imageFile,
  onImageFileChange,
  voiceBlob,
  onVoiceBlobChange,
  error,
}) {
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordChunksRef = useRef([]);
  const voicePreviewUrlRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isConvertingVoice, setIsConvertingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
      voicePreviewUrlRef.current = null;
    }
    if (!voiceBlob) {
      setVoicePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(voiceBlob);
    voicePreviewUrlRef.current = url;
    setVoicePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      voicePreviewUrlRef.current = null;
    };
  }, [voiceBlob]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function clearImage() {
    onImageFileChange(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function clearVoice() {
    onVoiceBlobChange(null);
    setRecordSeconds(0);
  }

  function handleImagePick(event) {
    setMediaError("");
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMediaError("Choose a JPEG, PNG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMediaError(`Image must be ${MAX_MEDIA_MB} MB or smaller.`);
      event.target.value = "";
      return;
    }
    onImageFileChange(file);
  }

  async function startRecording() {
    setMediaError("");
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMediaError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType =
        preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ||
        "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsRecording(false);

        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          setMediaError("Recording was empty. Try again.");
          return;
        }

        setIsConvertingVoice(true);
        try {
          const mp3Blob = await convertVoiceBlobToMp3(blob);
          if (mp3Blob.size > MAX_VOICE_BYTES) {
            setMediaError(`Voice note must be ${MAX_MEDIA_MB} MB or smaller.`);
            return;
          }
          onVoiceBlobChange(mp3Blob);
        } catch (error) {
          setMediaError("Could not convert voice note to MP3. Try again.");
        } finally {
          setIsConvertingVoice(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((current) => {
          if (current + 1 >= MAX_VOICE_SECONDS) {
            stopRecording();
            return MAX_VOICE_SECONDS;
          }
          return current + 1;
        });
      }, 1000);
    } catch (error) {
      setMediaError("Microphone access was denied or unavailable.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  return (
    <label className="grid gap-[3px] text-[11px] font-medium text-slate-700">
      <span className="sr-only">Reminder message</span>
      <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500">
        <textarea
          rows={2}
          placeholder="Remind me to..."
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          className="w-full resize-none border-0 bg-transparent px-[10px] py-[3px] text-[13px] text-slate-900 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-orange-100 px-[10px] py-[6px]">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImagePick}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold text-orange-600 transition hover:border-orange-300"
          >
            Upload Image
          </button>
          {!isRecording && !isConvertingVoice ? (
            <button
              type="button"
              onClick={startRecording}
              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold text-orange-600 transition hover:border-orange-300"
            >
              Record Voice
            </button>
          ) : isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-600 transition hover:border-rose-400"
            >
              Stop ({recordSeconds}s)
            </button>
          ) : (
            <span className="text-[10px] font-semibold text-slate-500">
              Converting to MP3...
            </span>
          )}
        </div>
      </div>

      {imagePreviewUrl ? (
        <div className="flex items-start gap-2 rounded-2xl border border-orange-100 bg-white px-[10px] py-[8px]">
          <img
            src={imagePreviewUrl}
            alt="Reminder attachment preview"
            className="h-16 w-16 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-slate-700">
              {imageFile?.name || "Image attached"}
            </p>
            <button
              type="button"
              onClick={clearImage}
              className="mt-1 text-[10px] font-semibold text-rose-500"
            >
              Remove image
            </button>
          </div>
        </div>
      ) : null}

      {voicePreviewUrl ? (
        <div className="rounded-2xl border border-orange-100 bg-white px-[10px] py-[8px]">
          <p className="text-[10px] font-semibold text-slate-700">Voice note attached (MP3)</p>
          <audio controls src={voicePreviewUrl} className="mt-1 w-full" />
          <button
            type="button"
            onClick={clearVoice}
            className="mt-1 text-[10px] font-semibold text-rose-500"
          >
            Remove voice note
          </button>
        </div>
      ) : null}

      {mediaError ? (
        <span className="text-[10px] font-normal text-rose-500">{mediaError}</span>
      ) : null}
      {error ? (
        <span className="text-[10px] font-normal text-rose-500">{error}</span>
      ) : null}
    </label>
  );
}

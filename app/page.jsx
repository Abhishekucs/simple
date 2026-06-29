"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "simple-journal-pages";
const CURRENT_PAGE_KEY = "simple-journal-current-page";
const TIMER_SECONDS = 15 * 60;
const FONT_SIZES = [16, 18, 20, 22];
const FONT_OPTIONS = [
  {
    key: "lato",
    label: "Lato",
    value: "Lato, -apple-system, BlinkMacSystemFont, \"SF Pro Text\", sans-serif"
  },
  {
    key: "arial",
    label: "Arial",
    value: "Arial, Helvetica, sans-serif"
  },
  {
    key: "system",
    label: "System",
    value: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Helvetica Neue\", Arial, sans-serif"
  },
  {
    key: "serif",
    label: "Serif",
    value: "Georgia, \"Times New Roman\", serif"
  }
];

function createPageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep the writing surface usable even when persistence is unavailable.
  }
}

function readPages() {
  const rawPages = readStorage(STORAGE_KEY);

  try {
    return JSON.parse(rawPages) || {};
  } catch {
    return {};
  }
}

function writePages(pages) {
  writeStorage(STORAGE_KEY, JSON.stringify(pages));
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

export default function JournalPage() {
  const editorRef = useRef(null);
  const cameraCancelledRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordingShouldSaveRef = useRef(true);
  const recordingStartedAtRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const timerEndsAtRef = useRef(null);
  const videoRef = useRef(null);
  const currentPageIdRef = useRef("");
  const textRef = useRef("");
  const [text, setText] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(TIMER_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamilyKey, setFontFamilyKey] = useState("system");

  function saveCurrentPage() {
    if (!currentPageIdRef.current) {
      return;
    }

    const pages = readPages();
    pages[currentPageIdRef.current] = {
      text: textRef.current,
      updatedAt: new Date().toISOString()
    };

    writePages(pages);
    writeStorage(CURRENT_PAGE_KEY, currentPageIdRef.current);
  }

  function setPageHash(pageId, mode) {
    const nextHash = `#${pageId}`;

    if (window.location.hash === nextHash) {
      return;
    }

    if (mode === "push") {
      window.history.pushState(null, "", nextHash);
      return;
    }

    window.history.replaceState(null, "", nextHash);
  }

  function openPage(pageId, mode = "replace") {
    const pages = readPages();

    if (!pages[pageId]) {
      pages[pageId] = {
        text: "",
        updatedAt: new Date().toISOString()
      };
      writePages(pages);
    }

    currentPageIdRef.current = pageId;
    textRef.current = pages[pageId].text || "";
    setText(textRef.current);
    writeStorage(CURRENT_PAGE_KEY, pageId);
    setPageHash(pageId, mode);
  }

  function resetTimer() {
    timerEndsAtRef.current = null;
    setTimerRunning(false);
    setTimerSeconds(TIMER_SECONDS);
  }

  function createBlankPage() {
    saveCurrentPage();
    resetTimer();
    cancelCameraMode();
    openPage(createPageId(), "push");
    editorRef.current?.focus();
  }

  function stopRecordingTracks() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  function resetRecordingState() {
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = null;
    setRecordingSeconds(0);
  }

  function saveRecording(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function finishRecording() {
    const blob = new Blob(recordingChunksRef.current, { type: "video/webm" });
    const shouldSave = recordingShouldSaveRef.current && !cameraCancelledRef.current;
    const shouldStayInCamera = !cameraCancelledRef.current;

    cameraCancelledRef.current = false;
    recordingShouldSaveRef.current = true;
    resetRecordingState();

    setRecordingState(shouldStayInCamera ? "preview" : "idle");

    if (shouldSave && blob.size > 0) {
      saveRecording(blob);
    }
  }

  function stopRecording(shouldSave = true) {
    if (recordingState === "recording") {
      recordingShouldSaveRef.current = shouldSave;
      mediaRecorderRef.current?.stop();
      return;
    }
  }

  function cancelCameraMode() {
    if (mediaRecorderRef.current?.state === "recording") {
      cameraCancelledRef.current = true;
      stopRecording(false);
    }

    stopRecordingTracks();
    resetRecordingState();
    setRecordingState("idle");
  }

  async function openCameraMode() {
    if (recordingState !== "idle") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingState("unavailable");
      window.setTimeout(() => setRecordingState("idle"), 1800);
      return;
    }

    try {
      cameraCancelledRef.current = false;
      setRecordingState("opening");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      recordingStreamRef.current = stream;
      setRecordingState("preview");
    } catch {
      stopRecordingTracks();
      setRecordingState("idle");
    }
  }

  function startCameraRecording() {
    if (!recordingStreamRef.current || recordingState !== "preview") {
      return;
    }

    const recorder = new MediaRecorder(recordingStreamRef.current);

    recordingChunksRef.current = [];
    recordingStartedAtRef.current = Date.now();
    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      finishRecording();
    });

    recorder.start();
    setRecordingSeconds(0);
    setRecordingState("recording");
  }

  function toggleTimer() {
    if (timerRunning) {
      timerEndsAtRef.current = null;
      setTimerRunning(false);
      return;
    }

    const nextTimerSeconds = timerSeconds > 0 ? timerSeconds : TIMER_SECONDS;
    timerEndsAtRef.current = Date.now() + nextTimerSeconds * 1000;
    setTimerSeconds(nextTimerSeconds);
    setTimerRunning(true);
    editorRef.current?.focus();
  }

  function cycleFontSize() {
    const currentIndex = FONT_SIZES.indexOf(fontSize);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % FONT_SIZES.length;
    setFontSize(FONT_SIZES[nextIndex]);
    editorRef.current?.focus();
  }

  function randomizeFont() {
    const randomFont = FONT_OPTIONS[Math.floor(Math.random() * FONT_OPTIONS.length)];
    const randomSize = FONT_SIZES[Math.floor(Math.random() * FONT_SIZES.length)];

    setFontFamilyKey(randomFont.key);
    setFontSize(randomSize);
    editorRef.current?.focus();
  }

  function handleTextChange(event) {
    const nextText = event.target.value;
    textRef.current = nextText;
    setText(nextText);
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      createBlankPage();
    }
  }

  useEffect(() => {
    openPage(createPageId());

    window.setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    textRef.current = text;
    saveCurrentPage();
  }, [text]);

  useEffect(() => {
    if (!timerRunning) {
      return undefined;
    }

    const updateTimer = () => {
      const remainingSeconds = Math.max(0, Math.ceil((timerEndsAtRef.current - Date.now()) / 1000));
      setTimerSeconds(remainingSeconds);

      if (remainingSeconds === 0) {
        timerEndsAtRef.current = null;
        setTimerRunning(false);
      }
    };

    const timerId = window.setInterval(updateTimer, 250);
    updateTimer();

    return () => {
      window.clearInterval(timerId);
    };
  }, [timerRunning]);

  useEffect(() => {
    if (!videoRef.current || !recordingStreamRef.current || recordingState === "idle") {
      return;
    }

    videoRef.current.srcObject = recordingStreamRef.current;
  }, [recordingState]);

  useEffect(() => {
    if (recordingState !== "recording") {
      return undefined;
    }

    const updateRecordingTimer = () => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
    };

    updateRecordingTimer();
    const timerId = window.setInterval(updateRecordingTimer, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [recordingState]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      stopRecordingTracks();
    };
  }, []);

  useEffect(() => {
    const syncPageFromHash = () => {
      const pageId = window.location.hash.replace(/^#/, "");

      if (pageId && pageId !== currentPageIdRef.current) {
        saveCurrentPage();
        openPage(pageId);
      }
    };

    window.addEventListener("hashchange", syncPageFromHash);
    window.addEventListener("popstate", syncPageFromHash);

    return () => {
      window.removeEventListener("hashchange", syncPageFromHash);
      window.removeEventListener("popstate", syncPageFromHash);
    };
  }, []);

  const currentFontFamily =
    FONT_OPTIONS.find((fontOption) => fontOption.key === fontFamilyKey)?.value || FONT_OPTIONS[2].value;
  const cameraActive = recordingState === "opening" || recordingState === "preview" || recordingState === "recording";

  return (
    <main
      className={`journal-shell${cameraActive ? " is-camera" : ""}`}
      aria-label="Journal page"
      style={{
        "--journal-font-size": `${fontSize}px`,
        "--journal-font-family": currentFontFamily
      }}
    >
      {cameraActive ? (
        <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label="Webcam preview" />
      ) : (
        <textarea
          ref={editorRef}
          className="journal-editor"
          value={text}
          spellCheck="true"
          autoComplete="off"
          placeholder="Just start"
          aria-label="Journal entry"
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
      )}

      <div className="journal-bottom" aria-label="Journal controls">
        {cameraActive ? (
          <div className="journal-options journal-options-left" aria-label="Recording options">
            <button
              className="journal-option"
              data-danger={recordingState === "recording"}
              disabled={recordingState === "opening"}
              type="button"
              onClick={recordingState === "recording" ? cancelCameraMode : startCameraRecording}
            >
              {recordingState === "opening"
                ? "Opening camera"
                : recordingState === "recording"
                  ? "Cancel recording"
                  : "Start recording"}
            </button>
            <span className="journal-option recording-time">{formatDuration(recordingSeconds)}</span>
          </div>
        ) : (
          <div className="journal-options journal-options-left" aria-label="Writing options">
            <button className="journal-option" type="button" onClick={cycleFontSize}>
              {fontSize}px
            </button>
            {FONT_OPTIONS.map((fontOption) => (
              <button
                className="journal-option"
                data-active={fontFamilyKey === fontOption.key}
                key={fontOption.key}
                type="button"
                onClick={() => {
                  setFontFamilyKey(fontOption.key);
                  editorRef.current?.focus();
                }}
              >
                {fontOption.label}
              </button>
            ))}
            <button className="journal-option" type="button" onClick={randomizeFont}>
              Random
            </button>
          </div>
        )}

        <div className="journal-options journal-options-right" aria-label="Page options">
          {!cameraActive && (
            <>
              <button
                className="journal-option session-timer"
                data-running={timerRunning}
                type="button"
                onClick={toggleTimer}
                aria-label={timerRunning ? "Pause timer" : "Start timer"}
              >
                <time dateTime={`PT${timerSeconds}S`}>{formatDuration(timerSeconds)}</time>
              </button>
              <button
                className="journal-option record-video"
                data-recording={recordingState === "recording"}
                type="button"
                onClick={openCameraMode}
              >
                {recordingState === "unavailable" ? "Unavailable" : "Record"}
              </button>
              <button className="journal-option new-page" type="button" onClick={createBlankPage}>
                New page
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

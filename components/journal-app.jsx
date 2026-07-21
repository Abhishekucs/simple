"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createJournalPage,
  getJournalPage,
  listJournalPages,
  sortPages,
  updateJournalPage
} from "../lib/journal-pages";

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

function isSafeLink(href) {
  return /^(https?:|mailto:|\/|#)/i.test(href);
}

function isJournalPageId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function hasMarkdownSyntax(value) {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~|\|.+\||[-*_]{3,}\s*$)|(\*\*|__|~~|`|\[[^\]]+\]\([^)]+\))/m.test(
    value
  );
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function getPageStorageKey(userId) {
  return `${CURRENT_PAGE_KEY}:${userId}`;
}

function getPageListItem(page) {
  return {
    id: page.id,
    filename: page.filename,
    title: page.title,
    updated_at: page.updated_at
  };
}

export default function JournalApp({ onToggleTheme, supabase, theme, user }) {
  const params = useParams();
  const router = useRouter();
  const routePageId = typeof params.id === "string" ? params.id : "";
  const editorRef = useRef(null);
  const timerEndsAtRef = useRef(null);
  const activeRef = useRef(true);
  const currentPageIdRef = useRef("");
  const handledPageIdRef = useRef("");
  const pageListRef = useRef([]);
  const pageRequestRef = useRef(0);
  const requestedPageIdRef = useRef("");
  const routePageIdRef = useRef(routePageId);
  const saveQueueRef = useRef(new Map());
  const saveDrainPromiseRef = useRef(null);
  const textRef = useRef("");
  const [currentPageId, setCurrentPageId] = useState("");
  const [dataError, setDataError] = useState("");
  const [fontFamilyKey, setFontFamilyKey] = useState("system");
  const [fontSize, setFontSize] = useState(18);
  const [journalInitialized, setJournalInitialized] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const [pageList, setPageList] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [text, setText] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(TIMER_SECONDS);

  function setPages(nextPages) {
    const sortedPages = sortPages(nextPages);
    pageListRef.current = sortedPages;
    setPageList(sortedPages);
  }

  function updatePageMetadata(page) {
    const nextPages = pageListRef.current.filter((savedPage) => savedPage.id !== page.id);
    setPages([...nextPages, getPageListItem(page)]);
  }

  function setPagePath(pageId, mode) {
    if (pageId === routePageIdRef.current) {
      return;
    }

    const nextPath = `/page/${encodeURIComponent(pageId)}`;

    if (mode === "push") {
      router.push(nextPath, { scroll: false });
      return;
    }

    router.replace(nextPath, { scroll: false });
  }

  function applyPage(page) {
    if (!activeRef.current) {
      return;
    }

    currentPageIdRef.current = page.id;
    handledPageIdRef.current = page.id;
    requestedPageIdRef.current = "";
    textRef.current = page.content_md;
    setCurrentPageId(page.id);
    setText(page.content_md);
    setMarkdownPreview(hasMarkdownSyntax(page.content_md));
    setPageLoading(false);
    updatePageMetadata(page);
    window.localStorage.setItem(getPageStorageKey(user.id), page.id);
  }

  function clearPageState() {
    currentPageIdRef.current = "";
    requestedPageIdRef.current = "";
    textRef.current = "";
    setCurrentPageId("");
    setText("");
    setMarkdownPreview(false);
    setPageLoading(false);
  }

  function showPageNotFound(pageId) {
    clearPageState();
    handledPageIdRef.current = pageId;
    setDataError("This page does not exist.");
  }

  function showPageLoadError(message) {
    clearPageState();
    handledPageIdRef.current = "";
    setDataError(message);
  }

  async function openPage(pageId) {
    if (!isJournalPageId(pageId)) {
      showPageNotFound(pageId);
      return false;
    }

    const requestId = pageRequestRef.current + 1;
    const requestRoutePageId = routePageIdRef.current;
    pageRequestRef.current = requestId;
    requestedPageIdRef.current = pageId;
    setDataError("");
    setPageLoading(true);

    try {
      const page = await getJournalPage(supabase, user.id, pageId);

      if (
        requestId !== pageRequestRef.current ||
        !activeRef.current ||
        requestRoutePageId !== routePageIdRef.current
      ) {
        return false;
      }

      if (!page) {
        showPageNotFound(pageId);
        return false;
      }

      applyPage(page);
      return true;
    } catch (error) {
      if (
        requestId === pageRequestRef.current &&
        activeRef.current &&
        requestRoutePageId === routePageIdRef.current
      ) {
        showPageLoadError(error.message);
      }

      return false;
    }
  }

  async function createAndOpenPage(historyMode = "push") {
    const requestId = pageRequestRef.current + 1;
    const pageId = window.crypto.randomUUID();
    pageRequestRef.current = requestId;
    requestedPageIdRef.current = pageId;
    setDataError("");
    setPageLoading(true);

    try {
      const page = await createJournalPage(supabase, user.id, pageId);

      if (requestId !== pageRequestRef.current || !activeRef.current) {
        return;
      }

      applyPage(page);
      setPagePath(page.id, historyMode);
      return true;
    } catch (error) {
      if (requestId === pageRequestRef.current && activeRef.current) {
        requestedPageIdRef.current = "";
        setPageLoading(false);
        setDataError(error.message);
      }

      return false;
    }
  }

  function cancelPageRequest() {
    if (!requestedPageIdRef.current) {
      return;
    }

    pageRequestRef.current += 1;
    requestedPageIdRef.current = "";
    setPageLoading(false);
    setDataError("");
  }

  function drainSaveQueue() {
    if (saveDrainPromiseRef.current) {
      return saveDrainPromiseRef.current;
    }

    const drainPromise = (async () => {
      while (saveQueueRef.current.size > 0) {
        const [pageId, content] = saveQueueRef.current.entries().next().value;
        saveQueueRef.current.delete(pageId);

        try {
          const savedPage = await updateJournalPage(supabase, user.id, pageId, content);

          if (activeRef.current) {
            updatePageMetadata(savedPage);
          }
        } catch (error) {
          if (!saveQueueRef.current.has(pageId)) {
            saveQueueRef.current.set(pageId, content);
          }

          throw error;
        }
      }
    })();

    saveDrainPromiseRef.current = drainPromise;

    drainPromise.then(
      () => {
        saveDrainPromiseRef.current = null;

        if (saveQueueRef.current.size > 0) {
          void drainSaveQueue();
          return;
        }

        if (activeRef.current) {
          setSaveStatus("saved");
        }
      },
      (error) => {
        saveDrainPromiseRef.current = null;

        if (activeRef.current) {
          setSaveStatus("error");
          setDataError(error.message);
        }
      }
    );

    return drainPromise;
  }

  function queuePageSave(pageId, content) {
    saveQueueRef.current.set(pageId, content);
    setDataError("");
    setSaveStatus("saving");
    void drainSaveQueue();
  }

  function retrySaves() {
    setDataError("");
    setSaveStatus("saving");
    void drainSaveQueue();
  }

  async function flushSaves() {
    try {
      while (saveDrainPromiseRef.current || saveQueueRef.current.size > 0) {
        await (saveDrainPromiseRef.current || drainSaveQueue());
      }

      return true;
    } catch {
      return false;
    }
  }

  function resetTimer() {
    timerEndsAtRef.current = null;
    setTimerRunning(false);
    setTimerSeconds(TIMER_SECONDS);
  }

  async function createBlankPage() {
    resetTimer();
    setMarkdownPreview(false);
    await createAndOpenPage("push");
  }

  function handlePageLinkClick(event, pageId) {
    if (pageId !== routePageIdRef.current) {
      return;
    }

    event.preventDefault();

    if (
      pageId !== currentPageIdRef.current &&
      pageId !== requestedPageIdRef.current &&
      pageId !== handledPageIdRef.current
    ) {
      resetTimer();
      void openPage(pageId);
    }
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
    queuePageSave(currentPageIdRef.current, nextText);
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void createBlankPage();
    }
  }

  async function handleSignOut() {
    setDataError("");
    const saved = await flushSaves();

    if (!saved) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setDataError(error.message);
      return;
    }

    router.replace("/");
  }

  useEffect(() => {
    routePageIdRef.current = routePageId;
  }, [routePageId]);

  useEffect(() => {
    activeRef.current = true;
    let isCurrentInitialization = true;

    async function initializeJournal() {
      setJournalInitialized(false);
      setPageLoading(true);
      setDataError("");

      try {
        const pages = await listJournalPages(supabase, user.id);

        if (!activeRef.current || !isCurrentInitialization) {
          return;
        }

        setPages(pages);
        const currentRoutePageId = routePageIdRef.current;
        const savedPageId = window.localStorage.getItem(getPageStorageKey(user.id));
        const routePage = pages.find((page) => page.id === currentRoutePageId);
        const savedPage = pages.find((page) => page.id === savedPageId);

        if (routePage) {
          await openPage(routePage.id);
        } else if (currentRoutePageId) {
          showPageNotFound(currentRoutePageId);
        } else if (savedPage || pages[0]) {
          const initialPage = savedPage || pages[0];
          const opened = await openPage(initialPage.id);

          if (opened && routePageIdRef.current === "") {
            setPagePath(initialPage.id, "replace");
          }
        } else {
          await createAndOpenPage("replace");
        }

        if (activeRef.current && isCurrentInitialization) {
          setJournalInitialized(true);
        }
      } catch (error) {
        if (activeRef.current && isCurrentInitialization) {
          setPageLoading(false);
          setDataError(error.message);
        }
      }
    }

    void initializeJournal();

    return () => {
      isCurrentInitialization = false;
      activeRef.current = false;
      pageRequestRef.current += 1;
    };
  }, [supabase, user.id]);

  useEffect(() => {
    if (!journalInitialized || !activeRef.current) {
      return;
    }

    if (!routePageId) {
      cancelPageRequest();
      const savedPageId = window.localStorage.getItem(getPageStorageKey(user.id));
      const savedPage = pageListRef.current.find((page) => page.id === savedPageId);
      const nextPageId = currentPageIdRef.current || savedPage?.id || pageListRef.current[0]?.id;

      if (!nextPageId) {
        return;
      }

      if (nextPageId === currentPageIdRef.current) {
        handledPageIdRef.current = nextPageId;
        setPageLoading(false);
        setDataError("");
        setPagePath(nextPageId, "replace");
        return;
      }

      resetTimer();
      void openPage(nextPageId).then((opened) => {
        if (opened && routePageIdRef.current === "") {
          setPagePath(nextPageId, "replace");
        }
      });
      return;
    }

    if (routePageId === requestedPageIdRef.current) {
      return;
    }

    if (routePageId === currentPageIdRef.current) {
      cancelPageRequest();
      handledPageIdRef.current = routePageId;
      setPageLoading(false);
      setDataError("");
      return;
    }

    if (routePageId === handledPageIdRef.current) {
      return;
    }

    resetTimer();
    void openPage(routePageId);
  }, [journalInitialized, routePageId, user.id]);

  useEffect(() => {
    if (!markdownPreview && !pageLoading) {
      editorRef.current?.focus();
    }
  }, [currentPageId, markdownPreview, pageLoading]);

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

  const currentFontFamily =
    FONT_OPTIONS.find((fontOption) => fontOption.key === fontFamilyKey)?.value || FONT_OPTIONS[2].value;

  return (
    <main
      className={`journal-shell${theme === "dark" ? " is-dark" : ""}`}
      aria-label="Journal page"
      style={{
        "--journal-font-size": `${fontSize}px`,
        "--journal-font-family": currentFontFamily
      }}
    >
      <aside className="journal-sidebar" aria-label="Saved pages">
        <div className="journal-sidebar-pages">
          {pageList.map((page) => (
            <Link
              className="journal-page-link"
              data-active={page.id === (routePageId || currentPageId)}
              href={`/page/${encodeURIComponent(page.id)}`}
              key={page.id}
              scroll={false}
              aria-current={page.id === routePageId ? "page" : undefined}
              onClick={(event) => handlePageLinkClick(event, page.id)}
            >
              <span className="journal-page-title">{page.title}</span>
            </Link>
          ))}
        </div>

        <div className="journal-sidebar-footer">
          <div className="journal-save-state" data-state={saveStatus} aria-live="polite">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "error" && (
              <button type="button" onClick={retrySaves}>
                Save failed. Retry
              </button>
            )}
          </div>
          <div className="journal-account">
            <span title={user.email}>{user.email}</span>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
          <button className="sidebar-new-page" type="button" onClick={() => void createBlankPage()}>
            + New page
          </button>
        </div>
      </aside>

      <section className="journal-workspace" aria-label="Writing area" data-loading={pageLoading}>
        {markdownPreview ? (
          <article className={`journal-markdown${text.trim() ? "" : " is-empty"}`} aria-label="Markdown preview">
            {text.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ node, href = "", children, ...props }) {
                    const safeHref = isSafeLink(href) ? href : "#";

                    return (
                      <a href={safeHref} rel="noreferrer" target="_blank" {...props}>
                        {children}
                      </a>
                    );
                  },
                  input({ node, ...props }) {
                    return <input {...props} readOnly />;
                  }
                }}
              >
                {text}
              </ReactMarkdown>
            ) : (
              "Just start"
            )}
          </article>
        ) : (
          <textarea
            ref={editorRef}
            className="journal-editor"
            disabled={pageLoading || !currentPageId}
            value={text}
            spellCheck="true"
            autoComplete="off"
            placeholder="Just start"
            aria-label="Journal entry"
            onBlur={() => {
              if (hasMarkdownSyntax(textRef.current)) {
                setMarkdownPreview(true);
              }
            }}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
        )}
      </section>

      {dataError && (
        <p className="journal-data-error" aria-live="assertive">
          {dataError}
        </p>
      )}

      <div className="journal-bottom" aria-label="Journal controls">
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

        <div className="journal-options journal-options-right" aria-label="Page options">
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
            className="journal-option markdown-preview"
            data-active={markdownPreview}
            type="button"
            onClick={() => setMarkdownPreview((isPreviewing) => !isPreviewing)}
          >
            {markdownPreview ? "Write" : "Preview"}
          </button>
          <button className="journal-option theme-toggle" type="button" onClick={onToggleTheme}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </main>
  );
}

const STORAGE_KEY = "elevator_exam_state_v1";
const QUESTION_BANK_CACHE_KEY = "elevator_exam_question_bank_v1";
const SAMPLE_ACCOUNT_KEY = "elevator_exam_sample_account_v1";
const SESSION_PDF_DB_NAME = "elevator_exam_session_pdf_v1";
const SESSION_PDF_STORE_NAME = "pdfs";
const SESSION_PDF_RECORD_KEY = "active-codebook";
const SESSION_PDF_BOOK_PREFIX = "book:";
const DEFAULT_EXAM_QUESTION_COUNT = 50;
const DEFAULT_EXAM_DURATION_SECONDS = 10800;
const DEFAULT_SAMPLE_QUESTION_COUNT = 5;
const DEFAULT_SAMPLE_DURATION_SECONDS = 1200;

const books = [
  { title: "A17.1", key: "a17-1", path: "./reference-pdfs/national/ASME-A17-1_2013.pdf", requiresLocalCopy: true },
  { title: "A17.2", key: "a17-2", path: "./reference-pdfs/national/A17-2_2014.pdf", requiresLocalCopy: true },
  { title: "A17.3", key: "a17-3", path: "./reference-pdfs/national/ASME-A17-3_2015.pdf", requiresLocalCopy: true },
  { title: "A17.5", key: "a17-5", path: "./reference-pdfs/national/ASME - A17 -5_2004.pdf", requiresLocalCopy: true },
  { title: "ANSI A10.4", key: "ansi-a10-4", path: "./reference-pdfs/national/ANSI_A10_4_2016.pdf", requiresLocalCopy: true },
  { title: "ASME A90.1", key: "asme-a90-1", path: "./reference-pdfs/national/ASME-A90-1-2009.pdf", requiresLocalCopy: true },
  { title: "B20.1", key: "b20-1", path: "./reference-pdfs/national/asme-b20-1-2015.pdf.pdf", requiresLocalCopy: true },
  { title: "ICC A117.1 ADA", key: "icc-a117-1", path: "./reference-pdfs/national/ICC - A117 -1- 2009 - ADA.pdf", requiresLocalCopy: true },
  {
    title: "New York Appendix K",
    key: "ny-appendix-k",
    path: "https://www.nyc.gov/assets/buildings/building_code/update_63_combined_instructions.pdf",
    online: true,
  },
  {
    title: "NYC Chapter 33",
    key: "nyc-chapter-33",
    path: "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter33_Con_DemoSafetyWBwm.pdf",
    online: true,
  },
  {
    title: "NYC Electrical Code",
    key: "nyc-electrical-code",
    path: "https://www.nyc.gov/assets/buildings/pdf/admin_sec_2007_elec_code.pdf",
    online: true,
  },
];

const SAMPLE_QUESTIONS = [
  {
    id: 1,
    text: "According to ASME A17.1, what is the minimum clear height required in an elevator machine room?",
    options: ["A) 6 ft 6 in", "B) 7 ft 0 in", "C) 7 ft 6 in", "D) 8 ft 0 in"],
    correct: "C",
  },
  {
    id: 2,
    text: "The working clearance in front of electrical equipment operating at 600V or less shall be at least:",
    options: ["A) 30 inches", "B) 36 inches", "C) 42 inches", "D) 48 inches"],
    correct: "B",
  },
  {
    id: 3,
    text: "In NYC Building Code, elevator hoistway doors must comply with which section?",
    options: ["A) BC 3000", "B) BC 3010", "C) BC 2800", "D) BC 2600"],
    correct: "B",
  },
  {
    id: 4,
    text: "What does A17.2 primarily cover?",
    options: [
      "A) Safety Code for Elevators",
      "B) Guide for Inspection of Elevators",
      "C) Performance-Based Safety Code",
      "D) Elevator Electrical Equipment",
    ],
    correct: "B",
  },
  {
    id: 5,
    text: "NEC Article 620 covers:",
    options: [
      "A) Elevators, Dumbwaiters, Escalators",
      "B) Fire Alarm Systems",
      "C) Emergency Lighting",
      "D) Hazardous Locations",
    ],
    correct: "A",
  },
  ...Array.from({ length: 45 }, (_, i) => ({
    id: i + 6,
    text: `Question ${i + 6}: Sample realistic question related to elevator safety, electrical requirements, or NYC code provisions.`,
    options: ["A) Option A", "B) Option B", "C) Option C", "D) Option D"],
    correct: "B",
  })),
];

let currentBook = null;
let questionBank = [...SAMPLE_QUESTIONS];
let questionBankSource = {
  type: "sample",
  label: "Built-in sample questions",
};
let uploadedPdfUrl = "";
let pdfJsModule = null;
let activePdfDocument = null;
let activePdfPageNumber = 1;
let activePdfRenderTask = null;

function openSessionPdfDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_PDF_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(SESSION_PDF_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function sessionPdfRecordKey(bookKey = "") {
  return bookKey ? `${SESSION_PDF_BOOK_PREFIX}${bookKey}` : SESSION_PDF_RECORD_KEY;
}

async function saveSessionPdf(file, bookKey = "") {
  const db = await openSessionPdfDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_PDF_STORE_NAME, "readwrite");
    transaction.objectStore(SESSION_PDF_STORE_NAME).put(
      {
        name: file.name,
        type: file.type,
        updatedAt: Date.now(),
        file,
      },
      sessionPdfRecordKey(bookKey)
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadSessionPdf(bookKey = "") {
  const db = await openSessionPdfDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_PDF_STORE_NAME, "readonly");
    const request = transaction.objectStore(SESSION_PDF_STORE_NAME).get(sessionPdfRecordKey(bookKey));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function getConfig() {
  const config = window.ELEVATOR_EXAM_CONFIG || {};
  const fullQuestionCount = Number(config.fullQuestionCount || config.questionCount);
  const fullDurationMinutes = Number(config.fullDurationMinutes);
  const sampleQuestionCount = Number(config.sampleQuestionCount);
  const sampleDurationMinutes = Number(config.sampleDurationMinutes);

  return {
    questionSheetUrl: String(config.questionSheetUrl || "").trim(),
    localQuestionBankUrl: String(config.localQuestionBankUrl || "./question-bank-1000.csv").trim(),
    fullQuestionCount: fullQuestionCount > 0 ? fullQuestionCount : DEFAULT_EXAM_QUESTION_COUNT,
    fullDurationSeconds: fullDurationMinutes > 0 ? fullDurationMinutes * 60 : DEFAULT_EXAM_DURATION_SECONDS,
    sampleQuestionCount: sampleQuestionCount > 0 ? sampleQuestionCount : DEFAULT_SAMPLE_QUESTION_COUNT,
    sampleDurationSeconds: sampleDurationMinutes > 0 ? sampleDurationMinutes * 60 : DEFAULT_SAMPLE_DURATION_SECONDS,
    sourceBlueprint: Array.isArray(config.sourceBlueprint) ? config.sourceBlueprint : [],
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function saveSampleAccount(email) {
  const account = {
    email: String(email || "").trim().toLowerCase(),
    createdAt: Date.now(),
  };
  localStorage.setItem(SAMPLE_ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

function loadSampleAccount() {
  try {
    const raw = localStorage.getItem(SAMPLE_ACCOUNT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

function isLocalDesktopServer() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

async function loadPdfJsModule() {
  if (pdfJsModule) {
    return pdfJsModule;
  }

  pdfJsModule = await import("./vendor/pdf.min.mjs");
  pdfJsModule.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  return pdfJsModule;
}

async function renderActivePdfPage() {
  if (!activePdfDocument) {
    return;
  }

  const canvas = document.getElementById("pdf-canvas");
  const pageStatus = document.getElementById("pdf-page-status");
  const previousButton = document.getElementById("pdf-prev-page");
  const nextButton = document.getElementById("pdf-next-page");

  if (!canvas) {
    return;
  }

  if (activePdfRenderTask) {
    activePdfRenderTask.cancel();
    activePdfRenderTask = null;
  }

  const page = await activePdfDocument.getPage(activePdfPageNumber);
  const container = document.getElementById("pdf-js-viewer");
  const availableWidth = Math.max(320, (container?.clientWidth || 720) - 24);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = availableWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  if (pageStatus) {
    pageStatus.textContent = `Page ${activePdfPageNumber} / ${activePdfDocument.numPages}`;
  }

  if (previousButton) {
    previousButton.disabled = activePdfPageNumber <= 1;
  }

  if (nextButton) {
    nextButton.disabled = activePdfPageNumber >= activePdfDocument.numPages;
  }

  activePdfRenderTask = page.render({ canvasContext: context, viewport });

  try {
    await activePdfRenderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      throw error;
    }
  } finally {
    activePdfRenderTask = null;
  }
}

async function loadPdfFileIntoCanvas(file) {
  const viewer = document.getElementById("pdf-viewer");
  const canvasViewer = document.getElementById("pdf-js-viewer");
  const status = document.getElementById("pdf-status");
  const pdfjs = await loadPdfJsModule();
  const bytes = await file.arrayBuffer();

  activePdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
  activePdfPageNumber = 1;

  if (viewer) {
    viewer.hidden = true;
  }

  if (canvasViewer) {
    canvasViewer.hidden = false;
  }

  await renderActivePdfPage();

  if (status) {
    status.textContent = "Loaded from this device for the current browser session.";
  }
}

async function preparePdfFromFile(file, { persist = false } = {}) {
  const viewer = document.getElementById("pdf-viewer");
  const openLink = document.getElementById("pdf-open-link");
  const title = document.getElementById("pdf-title");
  const status = document.getElementById("pdf-status");

  if (uploadedPdfUrl) {
    URL.revokeObjectURL(uploadedPdfUrl);
  }

  uploadedPdfUrl = URL.createObjectURL(file);

  if (viewer) {
    viewer.src = uploadedPdfUrl;
  }

  if (openLink) {
    openLink.href = uploadedPdfUrl;
    openLink.hidden = false;
  }

  if (title) {
    title.textContent = file.name;
  }

  if (status) {
    status.textContent = "Rendering PDF from this device...";
  }

  if (persist) {
    await saveSessionPdf(file);
  }

  await loadPdfFileIntoCanvas(file);
}

async function fetchLinkedBooks() {
  try {
    const response = await fetch("/linked-books", { cache: "no-store" });
    if (!response.ok) {
      return {};
    }

    return response.json();
  } catch {
    return {};
  }
}

async function linkReferenceBook(book) {
  const response = await fetch("/link-book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: book.key,
      title: book.title,
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Unable to link ${book.title}`);
  }

  return response.json();
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim().length);
  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] || "";
      return row;
    }, {});
  });
}

function normalizeQuestionSourceUrl(url) {
  if (!url) {
    return "";
  }

  if (url.includes("/pub?output=csv") || url.includes("/pubhtml")) {
    return url.replace("/pubhtml", "/pub?output=csv").replace(/\?.*$/, "?output=csv");
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return url;
  }

  const sheetId = match[1];
  const gidMatch = url.match(/[?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function normalizeQuestionRow(row, index) {
  const options = [row.option_a, row.option_b, row.option_c, row.option_d]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const correct = String(row.correct || "").trim().toUpperCase();
  const text = String(row.text || row.question || "").trim();

  if (!text || options.length < 2 || !["A", "B", "C", "D"].includes(correct)) {
    return null;
  }

  const normalizedOptions = options.map((option, optionIndex) => {
    const prefix = `${String.fromCharCode(65 + optionIndex)}) `;
    return option.startsWith(prefix) ? option : `${prefix}${option}`;
  });

  return {
    id: Number(row.id) || index + 1,
    text,
    options: normalizedOptions,
    correct,
    source: String(row.source || row.book || "").trim(),
    topic: String(row.topic || row.category || "").trim(),
    reference: String(row.reference || row.ref || "").trim(),
    section: String(row.section || row.code_section || row.part || "").trim(),
    page: String(row.page || row.page_number || "").trim(),
    location: String(row.location || row.answer_location || "").trim(),
    explanation: String(row.explanation || row.rationale || row.why || "").trim(),
    type: String(row.type || row.question_type || "multiple_choice").trim(),
  };
}

function cleanQuestionText(text) {
  return String(text || "")
    .replace(/^question\s+\d+\s*:\s*/i, "")
    .trim();
}

function loadCachedQuestionBank() {
  try {
    const raw = localStorage.getItem(QUESTION_BANK_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function cacheQuestionBank(bank) {
  try {
    localStorage.setItem(QUESTION_BANK_CACHE_KEY, JSON.stringify(bank));
  } catch {
    // Ignore cache write failures and continue with in-memory data.
  }
}

async function loadQuestionBank() {
  const { questionSheetUrl, localQuestionBankUrl } = getConfig();
  const cachedQuestionBank = loadCachedQuestionBank();
  const fallback = cachedQuestionBank || [...SAMPLE_QUESTIONS];

  async function loadCsvQuestionSource(url) {
    const response = await fetch(normalizeQuestionSourceUrl(url), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Question source request failed with ${response.status}`);
    }

    const csvText = await response.text();
    const parsedRows = parseCsv(csvText);
    const loadedQuestions = parsedRows
      .map((row, index) => normalizeQuestionRow(row, index))
      .filter(Boolean);

    if (!loadedQuestions.length) {
      throw new Error("Question source returned no valid questions");
    }

    return loadedQuestions;
  }

  try {
    if (questionSheetUrl) {
      const loadedQuestions = await loadCsvQuestionSource(questionSheetUrl);
      questionBank = loadedQuestions;
      questionBankSource = {
        type: "google-sheet",
        label: `Live Google Sheet (${loadedQuestions.length} questions)`,
      };
      cacheQuestionBank(loadedQuestions);
      return questionBank;
    }
  } catch (error) {
    // Fall through to the local CSV bank when the Google Sheet is private, offline, or blocked.
  }

  try {
    const loadedQuestions = await loadCsvQuestionSource(localQuestionBankUrl);
    questionBank = loadedQuestions;
    questionBankSource = {
      type: "local-csv",
      label: `Local CSV fallback (${loadedQuestions.length} questions)`,
    };
    cacheQuestionBank(loadedQuestions);
    return questionBank;
  } catch (error) {
    questionBank = fallback;
    questionBankSource = cachedQuestionBank
      ? {
          type: "cached",
          label: `Cached question bank (${cachedQuestionBank.length} questions)`,
        }
      : {
          type: "sample",
          label: "Built-in sample questions",
        };
    return questionBank;
  }
}

function getActiveQuestions(state = loadState()) {
  if (Array.isArray(state.examQuestions) && state.examQuestions.length) {
    return state.examQuestions;
  }

  return questionBank;
}

function shuffleArray(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function normalizeMatchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function questionMatchesBlueprint(question, rule) {
  const questionSource = normalizeMatchValue(question.source);
  const questionTopic = normalizeMatchValue(question.topic);
  const sourceMatch = normalizeMatchValue(rule.sourceMatch);
  const topicMatch = normalizeMatchValue(rule.topicMatch);

  const sourceOk = !sourceMatch || questionSource.includes(sourceMatch);
  const topicOk = !topicMatch || questionTopic.includes(topicMatch);
  return sourceOk && topicOk;
}

function selectQuestionsFromBlueprint(bank, questionCount, sourceBlueprint) {
  if (!sourceBlueprint.length) {
    return shuffleArray(bank).slice(0, Math.min(questionCount, bank.length));
  }

  const selected = [];
  const usedIds = new Set();

  sourceBlueprint.forEach((rule) => {
    const targetCount = Math.max(0, Number(rule.count) || 0);
    if (!targetCount) {
      return;
    }

    const matchingQuestions = shuffleArray(
      bank.filter((question) => !usedIds.has(question.id) && questionMatchesBlueprint(question, rule))
    ).slice(0, targetCount);

    matchingQuestions.forEach((question) => {
      selected.push(question);
      usedIds.add(question.id);
    });
  });

  if (selected.length < questionCount) {
    const leftovers = shuffleArray(bank.filter((question) => !usedIds.has(question.id)));
    selected.push(...leftovers.slice(0, questionCount - selected.length));
  }

  return shuffleArray(selected).slice(0, Math.min(questionCount, bank.length));
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const leftover = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${leftover}`;
}

function defaultState() {
  return {
    startedAt: null,
    endsAt: null,
    mode: "full",
    questionCount: DEFAULT_EXAM_QUESTION_COUNT,
    durationSeconds: DEFAULT_EXAM_DURATION_SECONDS,
    accountEmail: null,
    currentQ: 0,
    examQuestions: [],
    userAnswers: {},
    reviewMarks: {},
    submitted: false,
    score: null,
    submittedAt: null,
    expired: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  const state = defaultState();
  saveState(state);
  return state;
}

function calculateRemainingSeconds(state) {
  if (!state.endsAt || state.submitted) {
    return state.durationSeconds || DEFAULT_EXAM_DURATION_SECONDS;
  }

  return Math.max(0, Math.floor((state.endsAt - Date.now()) / 1000));
}

function calculateScore(state) {
  let score = 0;
  const activeQuestions = getActiveQuestions(state);
  const pointsPerQuestion = activeQuestions.length ? 100 / activeQuestions.length : 0;
  activeQuestions.forEach((question) => {
    if (state.userAnswers[question.id] === question.correct) {
      score += pointsPerQuestion;
    }
  });
  return Math.round(score);
}

function getUnansweredQuestions(state) {
  return getActiveQuestions(state).filter((question) => !state.userAnswers[question.id]);
}

function getQuestionDisplayNumber(state, question) {
  return getActiveQuestions(state).findIndex((item) => item.id === question.id) + 1;
}

function formatAnswerText(question, answerLetter) {
  if (!answerLetter) {
    return "No answer selected";
  }

  const optionIndex = answerLetter.charCodeAt(0) - 65;
  return question.options[optionIndex] || answerLetter;
}

function buildAnswerReference(question) {
  const details = [
    question.reference || question.source,
    question.section ? `Section: ${question.section}` : "",
    question.page ? `Page: ${question.page}` : "",
    question.location || question.topic,
  ].filter(Boolean);

  return details.length ? details.join(" • ") : "No answer location is listed in the question bank yet.";
}

function showIncompleteSubmitWarning(state) {
  const unanswered = getUnansweredQuestions(state);

  if (!unanswered.length) {
    return false;
  }

  const unansweredList = unanswered
    .map((question) => `Question ${getQuestionDisplayNumber(state, question)}`)
    .join(", ");
  const warning = document.getElementById("submit-warning");

  if (warning) {
    warning.hidden = false;
    warning.innerHTML = `
      <strong>This test is not complete.</strong>
      <span>You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}: ${unansweredList}.</span>
      <a href="./review.html">Go to review</a>
    `;
    warning.scrollIntoView({ block: "nearest" });
  }

  return true;
}

async function startNewExam({ mode = "full", accountEmail = null } = {}) {
  await loadQuestionBank();
  const startedAt = Date.now();
  const config = getConfig();
  const isSample = mode === "sample";
  const questionCount = isSample ? config.sampleQuestionCount : config.fullQuestionCount;
  const durationSeconds = isSample ? config.sampleDurationSeconds : config.fullDurationSeconds;
  const sourceBlueprint = isSample ? [] : config.sourceBlueprint;
  const selectedQuestions = selectQuestionsFromBlueprint(questionBank, questionCount, sourceBlueprint);
  const state = {
    startedAt,
    endsAt: startedAt + durationSeconds * 1000,
    mode: isSample ? "sample" : "full",
    questionCount,
    durationSeconds,
    accountEmail,
    currentQ: 0,
    examQuestions: selectedQuestions,
    userAnswers: {},
    reviewMarks: {},
    submitted: false,
    score: null,
    submittedAt: null,
    expired: false,
  };
  saveState(state);
  window.location.href = "./exam.html";
}

function submitExam({ expired = false } = {}) {
  const state = loadState();
  if (!expired && showIncompleteSubmitWarning(state)) {
    return;
  }

  state.submitted = true;
  state.expired = expired;
  state.submittedAt = Date.now();
  state.score = calculateScore(state);
  saveState(state);
  window.location.href = "./results.html";
}

function ensureExamState() {
  const state = loadState();
  if (!state.startedAt || state.submitted) {
    window.location.href = "./start.html";
    return null;
  }
  return state;
}

function renderQuestion(state) {
  const activeQuestions = getActiveQuestions(state);
  const question = activeQuestions[state.currentQ];
  const qNumber = document.getElementById("q-number");
  const currentQuestion = document.getElementById("current-question");
  const reviewStatus = document.getElementById("review-status");
  const totalQuestions = document.getElementById("total-questions");
  const nextButton = document.getElementById("next-question");

  if (!question || !qNumber || !currentQuestion) {
    return;
  }

  qNumber.textContent = String(state.currentQ + 1);
  if (totalQuestions) {
    totalQuestions.textContent = String(activeQuestions.length);
  }
  if (reviewStatus) {
    const pointsPerQuestion = activeQuestions.length ? Math.round(100 / activeQuestions.length) : 0;
    reviewStatus.textContent = state.reviewMarks[question.id] ? "Marked for review" : `${pointsPerQuestion} points each`;
  }
  if (nextButton) {
    nextButton.textContent = state.currentQ >= activeQuestions.length - 1 ? "Exam Complete" : "Next";
  }

  currentQuestion.innerHTML = `
    <p class="text-xl">${cleanQuestionText(question.text)}</p>
    <div class="answer-list">
      ${question.options
        .map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const checked = state.userAnswers[question.id] === letter ? "checked" : "";
          return `
            <label class="answer-option">
              <input type="radio" name="question-${question.id}" value="${letter}" ${checked}>
              <span>${option}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;

  currentQuestion.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      const nextState = loadState();
      nextState.userAnswers[question.id] = input.value;
      delete nextState.reviewMarks[question.id];
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
    });
  });
}

function buildAnswerOptions(question, selectedAnswer) {
  return `
    <div class="answer-list">
      ${question.options
        .map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const checked = selectedAnswer === letter ? "checked" : "";
          return `
            <label class="answer-option">
              <input type="radio" name="question-${question.id}" value="${letter}" ${checked}>
              <span>${option}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function getReviewQuestions(state) {
  return getActiveQuestions(state).filter((question) => !state.userAnswers[question.id] || state.reviewMarks[question.id]);
}

function renderReviewListPage(state) {
  const container = document.getElementById("review-list-page");

  if (!container) {
    return;
  }

  const reviewQuestions = getReviewQuestions(state);
  container.innerHTML = "";

  if (!reviewQuestions.length) {
    container.innerHTML = `
      <div class="review-empty">
        <p class="eyebrow">Review Complete</p>
        <p class="muted">There are no unanswered or marked questions left.</p>
      </div>
    `;
    return;
  }

  reviewQuestions.forEach((question) => {
    const card = document.createElement("section");
    card.className = "review-question-card";
    const needsReview = !!state.reviewMarks[question.id];
    const answered = !!state.userAnswers[question.id];
    const displayNumber = getActiveQuestions(state).findIndex((item) => item.id === question.id) + 1;

    card.innerHTML = `
      <div class="question-meta">
        <div>
          <span class="muted">Question</span>
          <strong style="font-size: 1.8rem; margin-left: 8px;">${displayNumber}</strong>
        </div>
        <div class="muted">${needsReview ? "Marked for review" : answered ? "Answered" : "Unanswered"}</div>
      </div>
      <h3>${cleanQuestionText(question.text)}</h3>
      ${buildAnswerOptions(question, state.userAnswers[question.id])}
    `;

    card.querySelectorAll("input[type='radio']").forEach((input) => {
      input.addEventListener("change", () => {
        const nextState = loadState();
        nextState.userAnswers[question.id] = input.value;
        delete nextState.reviewMarks[question.id];
        saveState(nextState);
        renderReviewListPage(nextState);
      });
    });

    container.appendChild(card);
  });
}

function markCurrentQuestionForReview() {
  const state = loadState();
  const question = getActiveQuestions(state)[state.currentQ];

  if (!question) {
    return state;
  }

  state.reviewMarks[question.id] = true;
  saveState(state);
  return state;
}

function renderReviewMap(state) {
  const reviewGrid = document.getElementById("review-grid");

  if (!reviewGrid) {
    return;
  }

  reviewGrid.innerHTML = "";

  getActiveQuestions(state).forEach((question, index) => {
    const tile = document.createElement("button");
    const hasAnswer = !!state.userAnswers[question.id];
    const needsReview = !!state.reviewMarks[question.id];

    tile.type = "button";
    tile.className = "review-tile";

    if (hasAnswer) {
      tile.classList.add("answered");
    }

    if (needsReview) {
      tile.classList.add("review");
    }

    if (index === state.currentQ) {
      tile.classList.add("current");
    }

    tile.textContent = String(question.id);
    tile.addEventListener("click", () => {
      const nextState = loadState();
      nextState.currentQ = index;
      saveState(nextState);

      if (document.body.dataset.page === "review") {
        window.location.href = "./exam.html";
        return;
      }

      renderQuestion(nextState);
      renderReviewMap(nextState);
    });

    reviewGrid.appendChild(tile);
  });
}

async function updateReferenceStatuses() {
  return Promise.resolve();
}

async function renderPreviewBookSetup() {
  const container = document.getElementById("preview-book-setup-list");
  const onlineList = document.getElementById("online-book-list");

  if (!container && !onlineList) {
    return;
  }

  const requiredBooks = books.filter((book) => book.requiresLocalCopy);
  const onlineBooks = books.filter((book) => book.online);

  if (onlineList) {
    onlineList.textContent = onlineBooks.map((book) => book.title).join(", ");
  }

  if (!container) {
    return;
  }

  container.innerHTML = "";

  requiredBooks.forEach((book) => {
    const row = document.createElement("div");
    row.className = "book-setup-row";
    row.innerHTML = `
      <div>
        <strong>${book.title}</strong>
        <span class="book-link-status">No PDF selected</span>
      </div>
      <label class="btn btn-secondary setup-reference-book">
        Choose PDF
        <input type="file" accept="application/pdf" hidden>
      </label>
    `;

    const status = row.querySelector(".book-link-status");
    const input = row.querySelector("input");

    loadSessionPdf(book.key)
      .then((record) => {
        if (record?.file && status) {
          status.textContent = record.name || record.file.name;
        }
      })
      .catch(() => {});

    input?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (status) {
        status.textContent = "Saving...";
      }

      await saveSessionPdf(file, book.key);

      if (status) {
        status.textContent = file.name;
      }
    });

    container.appendChild(row);
  });
}

async function openReferenceBook(book) {
  if (!book) {
    return;
  }

  if (book.online) {
    window.open(book.path, "_blank", "noopener");
    return;
  }

  window.open(`./viewer.html?book=${encodeURIComponent(book.key)}`, "_blank", "noopener");
}

async function loadReferenceBookInPanel(book) {
  if (!book) {
    return;
  }

  const viewer = document.getElementById("pdf-viewer");
  const title = document.getElementById("pdf-title");
  const status = document.getElementById("pdf-status");

  if (!viewer) {
    await openReferenceBook(book);
    return;
  }

  if (title) {
    title.textContent = book.title;
  }

  document.getElementById("pdf-js-viewer")?.setAttribute("hidden", "");
  if (viewer) {
    viewer.hidden = false;
  }

  if (status) {
    status.textContent = book.online ? "Loading online reference..." : "Loading local PDF...";
  }

  if (book.online) {
    viewer.src = book.path;
    if (status) {
      status.textContent = "If this online PDF is blocked by the publisher, open it from the reference list in a new tab.";
    }
    return;
  }

  try {
    let response = await fetch(book.path, { method: "HEAD", cache: "no-store" });

    if (response.ok) {
      viewer.src = `${book.path}#toolbar=1`;
      if (status) {
        status.textContent = "Loaded from the hosted reference PDF.";
      }
      return;
    }

    if (!isLocalDesktopServer()) {
      if (status) {
        status.textContent = "This reference is not hosted online. Use the PDF picker above to load your copy for this session.";
      }
      return;
    }

    response = await fetch(`/book-pdf/${encodeURIComponent(book.key)}`, { cache: "no-store" });

    if (response.status === 404) {
      await linkReferenceBook(book);
      await updateReferenceStatuses();
      response = await fetch(`/book-pdf/${encodeURIComponent(book.key)}`, { cache: "no-store" });
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Unable to load ${book.title}`);
    }

    viewer.src = `/book-pdf/${encodeURIComponent(book.key)}#toolbar=1`;
    if (status) {
      status.textContent = "Loaded from your linked local PDF.";
    }
  } catch (error) {
    if (status) {
      status.textContent = "Could not load the PDF in the panel.";
    }
    window.alert(
      `${error instanceof Error ? error.message : "Unable to load reference book"}\n\nUse the PDF picker to load a PDF from this device for the current browser session.`
    );
  }
}

function bindReferenceButtons() {
  document.querySelectorAll(".reference-book, .online-reference").forEach((button) => {
    const book = books.find((entry) => entry.key === button.dataset.bookKey);
    button.addEventListener("click", () => openReferenceBook(book));
  });
}

function bindPdfPageButtons() {
  const previousButton = document.getElementById("pdf-prev-page");
  const nextButton = document.getElementById("pdf-next-page");

  previousButton?.addEventListener("click", async () => {
    if (!activePdfDocument || activePdfPageNumber <= 1) {
      return;
    }

    activePdfPageNumber -= 1;
    await renderActivePdfPage();
  });

  nextButton?.addEventListener("click", async () => {
    if (!activePdfDocument || activePdfPageNumber >= activePdfDocument.numPages) {
      return;
    }

    activePdfPageNumber += 1;
    await renderActivePdfPage();
  });
}

function bindPdfUpload() {
  const input = document.getElementById("pdf-input");
  const viewer = document.getElementById("pdf-viewer");
  const status = document.getElementById("pdf-status");

  if (!input || !viewer) {
    return;
  }

  bindPdfPageButtons();

  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      await preparePdfFromFile(file, { persist: true });
    } catch (error) {
      viewer.hidden = false;
      document.getElementById("pdf-js-viewer")?.setAttribute("hidden", "");
      if (status) {
        status.textContent = "Could not render the PDF in-page. Use the open link above.";
      }
      console.error("PDF render failed", error);
    }
  });
}

async function initViewerPage() {
  bindPdfPageButtons();

  const params = new URLSearchParams(window.location.search);
  const bookKey = params.get("book") || "";
  const book = books.find((entry) => entry.key === bookKey);
  const title = document.getElementById("pdf-title");
  const status = document.getElementById("pdf-status");

  if (title) {
    title.textContent = book?.title || "Reference PDF";
  }

  if (!bookKey) {
    if (status) {
      status.textContent = "No reference book was selected.";
    }
    return;
  }

  try {
    const record = await loadSessionPdf(bookKey);

    if (!record?.file) {
      if (status) {
        status.textContent = "This PDF was not selected on the opening screen.";
      }
      return;
    }

    await preparePdfFromFile(record.file);
  } catch (error) {
    if (status) {
      status.textContent = "Could not open this PDF from local browser storage.";
    }
  }
}

async function loadPreparedPdfIntoExam() {
  const status = document.getElementById("pdf-status");

  try {
    const record = await loadSessionPdf();

    if (!record?.file) {
      return;
    }

    if (status) {
      status.textContent = `Loading prepared PDF: ${record.name || record.file.name}`;
    }

    await preparePdfFromFile(record.file);
  } catch (error) {
    if (status) {
      status.textContent = "Could not load the pre-selected PDF. Choose it again from this page.";
    }
  }
}

function bindPreExamPdfUpload() {
  const input = document.getElementById("preexam-pdf-input");
  const status = document.getElementById("preexam-pdf-status");

  if (!input) {
    return;
  }

  loadSessionPdf()
    .then((record) => {
      if (record?.file && status) {
        status.textContent = `Ready for exam: ${record.name || record.file.name}`;
      }
    })
    .catch(() => {
      if (status) {
        status.textContent = "No PDF loaded yet.";
      }
    });

  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (status) {
      status.textContent = "Saving PDF for this exam session...";
    }

    try {
      await saveSessionPdf(file);
      if (status) {
        status.textContent = `Ready for exam: ${file.name}`;
      }
    } catch (error) {
      if (status) {
        status.textContent = "Could not prepare this PDF. You can still choose it from the exam page.";
      }
    }
  });
}

function initReviewPage() {
  const state = ensureExamState();
  if (!state) {
    return;
  }

  renderReviewListPage(state);
}

async function initStartPage() {
  await renderPreviewBookSetup();
  bindPreExamPdfUpload();
  const account = loadSampleAccount();
  const emailInput = document.getElementById("sample-email");
  const status = document.getElementById("sample-account-status");

  if (account?.email && emailInput) {
    emailInput.value = account.email;
  }

  document.getElementById("sample-account-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = emailInput?.value || "";

    if (status) {
      status.textContent = "Loading question bank...";
    }

    const savedAccount = isValidEmail(email) ? saveSampleAccount(email) : null;
    startNewExam({ mode: "sample", accountEmail: savedAccount?.email || null });
  });

  document.getElementById("begin-full-exam")?.addEventListener("click", () => {
    if (status) {
      status.textContent = "Loading question bank...";
    }
    startNewExam({ mode: "full", accountEmail: account?.email || null });
  });

  document.getElementById("start-score-link")?.addEventListener("click", () => {
    window.location.href = "./results.html";
  });
}

async function initExamPage() {
  await loadQuestionBank();
  let state = ensureExamState();
  if (!state) {
    return;
  }

  renderQuestion(state);
  renderReviewMap(state);

  const modeLabel = document.getElementById("exam-mode-label");
  if (modeLabel) {
    modeLabel.textContent =
      state.mode === "sample"
        ? `Sample Exam - ${state.questionCount} Questions - ${Math.round(state.durationSeconds / 60)} Minutes`
        : `Full Exam - ${state.questionCount} Questions - ${Math.round(state.durationSeconds / 60)} Minutes`;
  }

  bindReferenceButtons();
  await updateReferenceStatuses();

  const timer = document.getElementById("timer");
  const previousButton = document.getElementById("prev-question");
  const markReviewButton = document.getElementById("mark-review");
  const nextButton = document.getElementById("next-question");
  const submitButton = document.getElementById("submit-exam");

  const syncTimer = () => {
    state = loadState();
    const remaining = calculateRemainingSeconds(state);

    if (timer) {
      timer.textContent = formatTime(remaining);
    }

    if (remaining <= 0) {
      submitExam({ expired: true });
    }
  };

  syncTimer();
  const timerId = window.setInterval(syncTimer, 1000);

  previousButton?.addEventListener("click", () => {
    const nextState = loadState();
    if (nextState.currentQ > 0) {
      nextState.currentQ -= 1;
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
    }
  });

  markReviewButton?.addEventListener("click", () => {
    const nextState = markCurrentQuestionForReview();
    renderQuestion(nextState);
    renderReviewMap(nextState);
  });

  nextButton?.addEventListener("click", () => {
    const nextState = loadState();
    const activeQuestions = getActiveQuestions(nextState);
    const currentQuestion = activeQuestions[nextState.currentQ];

    if (currentQuestion && !nextState.userAnswers[currentQuestion.id]) {
      nextState.reviewMarks[currentQuestion.id] = true;
    }

    if (nextState.currentQ < activeQuestions.length - 1) {
      nextState.currentQ += 1;
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
      return;
    }

    saveState(nextState);
    window.clearInterval(timerId);
    submitExam();
  });

  submitButton?.addEventListener("click", () => {
    window.clearInterval(timerId);
    submitExam();
  });

  window.addEventListener("beforeunload", () => {
    window.clearInterval(timerId);
  });
}

async function initResultsPage() {
  await loadQuestionBank();
  const state = loadState();
  const scoreCircle = document.getElementById("score-circle");
  const scoreText = document.getElementById("score-text");
  const modeLabel = document.getElementById("results-mode-label");
  const answerReviewList = document.getElementById("answer-review-list");

  if (!scoreCircle || !scoreText) {
    return;
  }

  if (state.score === null) {
    scoreCircle.innerHTML = `<div><div class="score-main">--</div><div class="score-sub">No score yet</div></div>`;
    scoreText.innerHTML = "No exam has been completed yet. Start from the opening screen, take the exam, and this page will show the score.";
  } else {
    const activeQuestions = getActiveQuestions(state);
    const correctCount = activeQuestions.filter((question) => state.userAnswers[question.id] === question.correct).length;
    const incorrectCount = activeQuestions.length - correctCount;
    const unansweredCount = getUnansweredQuestions(state).length;

    if (modeLabel) {
      modeLabel.textContent = state.mode === "sample" ? "Sample Exam Complete" : "Full Exam Complete";
    }
    scoreCircle.innerHTML = `<div><div class="score-main">${state.score}</div><div class="score-sub">/ 100</div></div>`;
    scoreText.innerHTML = `
      You scored <strong>${state.score}</strong> out of 100 points.
      <br><strong>${correctCount}</strong> correct, <strong>${incorrectCount}</strong> incorrect, <strong>${unansweredCount}</strong> unanswered.
      ${state.expired ? '<br><span style="color:#b03f3f">Time expired</span>' : ""}
    `;
  }

  if (answerReviewList) {
    const activeQuestions = getActiveQuestions(state);
    answerReviewList.innerHTML = "";

    if (!activeQuestions.length) {
      answerReviewList.innerHTML = `<p class="muted">No questions are available for review.</p>`;
    }

    activeQuestions.forEach((question, index) => {
      const userAnswer = state.userAnswers[question.id] || "";
      const isCorrect = userAnswer === question.correct;
      const card = document.createElement("article");
      card.className = `answer-review-card ${isCorrect ? "correct" : "incorrect"}`;
      card.innerHTML = `
        <div class="answer-review-topline">
          <span class="badge ${isCorrect ? "good" : "warn"}">${isCorrect ? "Correct" : userAnswer ? "Incorrect" : "Unanswered"}</span>
          <span class="muted">Question ${index + 1}</span>
        </div>
        <h3>${cleanQuestionText(question.text)}</h3>
        <div class="answer-review-answers">
          <p><strong>Your answer:</strong> ${formatAnswerText(question, userAnswer)}</p>
          <p><strong>Correct answer:</strong> ${formatAnswerText(question, question.correct)}</p>
        </div>
        <div class="answer-reference">
          <strong>Where to verify:</strong> ${buildAnswerReference(question)}
        </div>
        ${question.explanation ? `<div class="answer-explanation"><strong>Explanation:</strong> ${question.explanation}</div>` : ""}
      `;
      answerReviewList.appendChild(card);
    });
  }

  document.getElementById("results-start-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    resetState();
    window.location.href = "./start.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  if (page === "start") {
    await initStartPage();
  } else if (page === "exam") {
    await initExamPage();
  } else if (page === "review") {
    await loadQuestionBank();
    initReviewPage();
  } else if (page === "results") {
    await initResultsPage();
  } else if (page === "viewer") {
    await initViewerPage();
  }
});

import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 4175);
const HOST = process.env.HOST || "127.0.0.1";
const LINKED_BOOKS_PATH = path.join(__dirname, ".linked-books.json");

app.use(express.json());
app.use(express.static(__dirname));

const allowedRoots = [
  path.join(__dirname, "reference-pdfs"),
];

function resolveBookPath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(__dirname, normalized);
  const allowed = allowedRoots.some((root) => absolute.startsWith(root + path.sep) || absolute === root);

  if (!allowed) {
    throw new Error("Book path is outside the allowed reference folder");
  }

  return absolute;
}

async function readLinkedBooks() {
  try {
    const raw = await fs.readFile(LINKED_BOOKS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeLinkedBooks(linkedBooks) {
  await fs.writeFile(LINKED_BOOKS_PATH, JSON.stringify(linkedBooks, null, 2));
}

async function chooseBookFile(title) {
  const safeTitle = String(title || "reference book").replace(/"/g, "'");
  const script = `POSIX path of (choose file with prompt "Select your ${safeTitle} PDF")`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim();
}

async function resolveOpenBookRequest({ key, title, path: inputPath, linkIfMissing = false }) {
  const linkedBooks = await readLinkedBooks();
  const linkedPath = key ? linkedBooks[key]?.path : "";

  if (linkedPath) {
    return linkedPath;
  }

  if (key && linkIfMissing) {
    const selectedPath = await chooseBookFile(title || key);
    linkedBooks[key] = {
      title: title || key,
      path: selectedPath,
      linkedAt: Date.now(),
    };
    await writeLinkedBooks(linkedBooks);
    return selectedPath;
  }

  if (inputPath) {
    return resolveBookPath(inputPath);
  }

  throw new Error("Book has not been linked yet");
}

async function constrainPreviewWindow() {
  const script = `
    tell application "Preview"
      activate
    end tell

    tell application "Finder"
      set screenBounds to bounds of window of desktop
    end tell

    set screenLeft to item 1 of screenBounds
    set screenTop to item 2 of screenBounds
    set screenRight to item 3 of screenBounds
    set screenBottom to item 4 of screenBounds
    set screenWidth to screenRight - screenLeft
    set screenHeight to screenBottom - screenTop

    set targetWidth to screenWidth * 0.25
    set targetHeight to screenHeight * 0.88
    set targetLeft to screenLeft
    set targetTop to screenTop + ((screenHeight - targetHeight) / 2)
    set targetRight to targetLeft + targetWidth
    set targetBottom to targetTop + targetHeight

    tell application "Preview"
      repeat 20 times
        if (count of windows) > 0 then exit repeat
        delay 0.1
      end repeat

      if (count of windows) > 0 then
        set bounds of front window to {targetLeft, targetTop, targetRight, targetBottom}
        delay 0.6
        set bounds of front window to {targetLeft, targetTop, targetRight, targetBottom}
      end if

      activate
    end tell
  `;

  await execFileAsync("osascript", ["-e", script]);
}

app.post("/open-book", async (req, res) => {
  try {
    const inputKey = String(req.body?.key || "");
    const inputTitle = String(req.body?.title || inputKey || "");
    const inputPath = String(req.body?.path || "");
    const linkIfMissing = req.body?.linkIfMissing === true;
    if (!inputKey && !inputPath) {
      res.status(400).json({ error: "Missing book key or path" });
      return;
    }

    const absolutePath = await resolveOpenBookRequest({
      key: inputKey,
      title: inputTitle,
      path: inputPath,
      linkIfMissing,
    });
    await execFileAsync("open", ["-a", "Preview", absolutePath]);
    await constrainPreviewWindow();
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to open book" });
  }
});

app.get("/linked-books", async (_req, res) => {
  const linkedBooks = await readLinkedBooks();
  const response = Object.fromEntries(
    Object.entries(linkedBooks).map(([key, value]) => [
      key,
      {
        title: value.title,
        fileName: path.basename(value.path),
        linkedAt: value.linkedAt,
      },
    ])
  );
  res.json(response);
});

app.get("/book-pdf/:key", async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    const linkedBooks = await readLinkedBooks();
    const linkedPath = linkedBooks[key]?.path;

    if (!linkedPath) {
      res.status(404).send("Book has not been linked yet");
      return;
    }

    await fs.access(linkedPath);
    res.sendFile(linkedPath, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "Unable to load book PDF");
  }
});

app.post("/link-book", async (req, res) => {
  try {
    const key = String(req.body?.key || "").trim();
    const title = String(req.body?.title || key || "reference book").trim();

    if (!key) {
      res.status(400).json({ error: "Missing book key" });
      return;
    }

    const selectedPath = await chooseBookFile(title);
    const linkedBooks = await readLinkedBooks();
    linkedBooks[key] = {
      title,
      path: selectedPath,
      linkedAt: Date.now(),
    };
    await writeLinkedBooks(linkedBooks);
    res.json({
      key,
      title,
      fileName: path.basename(selectedPath),
      linkedAt: linkedBooks[key].linkedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to link book" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Elevator exam app running at http://${HOST}:${PORT}/start.html`);
});

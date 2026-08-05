import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

export type KnowledgeCategory = "documentation" | "runbook" | "postmortem";

export type ParsedKnowledgeChunk = {
  sequence: number;
  title: string;
  section: string;
  content: string;
  eventTypes: string[];
  tokenEstimate: number;
  embeddingInput: string;
};

export type ParsedKnowledgeDocument = {
  id: string;
  sourcePath: string;
  title: string;
  category: KnowledgeCategory;
  eventTypes: string[];
  checksum: string;
  chunks: ParsedKnowledgeChunk[];
};

const MAX_CHUNK_CHARACTERS = 1_800;

const categoryByDirectory: Record<string, KnowledgeCategory> = {
  events: "documentation",
  security: "documentation",
  runbooks: "runbook",
  postmortems: "postmortem",
};

type Frontmatter = {
  title?: string;
  eventTypes: string[];
};

function parseFrontmatter(markdown: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { frontmatter: { eventTypes: [] }, body: markdown };
  }

  const lines = markdown.split(/\r?\n/);
  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line === "---",
  );

  if (closingIndex === -1) {
    throw new Error(
      "Knowledge document has an unterminated frontmatter block.",
    );
  }

  const values = new Map<string, string>();

  for (const line of lines.slice(1, closingIndex)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);

    if (match) {
      values.set(match[1], match[2].trim());
    }
  }

  const eventTypesValue = values.get("eventTypes") ?? "";
  const eventTypes = eventTypesValue
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

  return {
    frontmatter: {
      title: values.get("title")?.replace(/^['"]|['"]$/g, ""),
      eventTypes,
    },
    body: lines.slice(closingIndex + 1).join("\n"),
  };
}

function normalizeContent(lines: string[]) {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongContent(content: string): string[] {
  if (content.length <= MAX_CHUNK_CHARACTERS) {
    return [content];
  }

  const parts: string[] = [];
  let currentPart = "";

  for (const paragraph of content.split(/\n\n+/)) {
    const nextPart = currentPart ? `${currentPart}\n\n${paragraph}` : paragraph;

    if (nextPart.length <= MAX_CHUNK_CHARACTERS) {
      currentPart = nextPart;
      continue;
    }

    if (currentPart) {
      parts.push(currentPart);
      currentPart = "";
    }

    for (
      let offset = 0;
      offset < paragraph.length;
      offset += MAX_CHUNK_CHARACTERS
    ) {
      parts.push(paragraph.slice(offset, offset + MAX_CHUNK_CHARACTERS));
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
}

function chunkMarkdown(
  markdown: string,
  documentTitle: string,
  eventTypes: string[],
): ParsedKnowledgeChunk[] {
  const chunks: Omit<ParsedKnowledgeChunk, "sequence">[] = [];
  const lines = markdown.split(/\r?\n/);
  let section = documentTitle;
  let contentLines: string[] = [];

  const flush = () => {
    const content = normalizeContent(contentLines);
    contentLines = [];

    if (!content) {
      return;
    }

    for (const contentPart of splitLongContent(content)) {
      const embeddingInput = `${documentTitle}\nSection: ${section}\n\n${contentPart}`;

      chunks.push({
        title: documentTitle,
        section,
        content: contentPart,
        eventTypes,
        tokenEstimate: Math.ceil(embeddingInput.length / 4),
        embeddingInput,
      });
    }
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);

    if (!heading) {
      contentLines.push(line);
      continue;
    }

    flush();

    if (heading[1].length === 1) {
      section = documentTitle;
      continue;
    }

    section = heading[2];
  }

  flush();

  return chunks.map((chunk, index) => ({ ...chunk, sequence: index + 1 }));
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return listMarkdownFiles(path);
      }

      return extname(entry.name).toLowerCase() === ".md" ? [path] : [];
    }),
  );

  return files.flat();
}

export async function parseKnowledgeDirectory(
  knowledgeDirectory: string,
): Promise<ParsedKnowledgeDocument[]> {
  const documents: ParsedKnowledgeDocument[] = [];

  for (const [directoryName, category] of Object.entries(categoryByDirectory)) {
    const categoryDirectory = join(knowledgeDirectory, directoryName);
    const files = await listMarkdownFiles(categoryDirectory);

    for (const filePath of files) {
      const rawMarkdown = await readFile(filePath, "utf8");
      const { frontmatter, body } = parseFrontmatter(rawMarkdown);
      const h1 = /^#\s+(.+?)\s*$/m.exec(body)?.[1];
      const id = basename(filePath, extname(filePath));
      const title = frontmatter.title ?? h1 ?? id.replace(/-/g, " ");
      const sourcePath = relative(knowledgeDirectory, filePath).replaceAll(
        "\\",
        "/",
      );
      const chunks = chunkMarkdown(body, title, frontmatter.eventTypes);

      if (chunks.length === 0) {
        throw new Error(
          `Knowledge document ${sourcePath} does not contain a chunkable section.`,
        );
      }

      documents.push({
        id,
        sourcePath,
        title,
        category,
        eventTypes: frontmatter.eventTypes,
        checksum: createHash("sha256").update(rawMarkdown).digest("hex"),
        chunks,
      });
    }
  }

  return documents.sort((left, right) => left.id.localeCompare(right.id));
}

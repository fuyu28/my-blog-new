import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { parsePost, FrontmatterValidationError } from "../src/lib/content/parsePost";

type SerializedPostEntry = {
  slug: string;
  path: string;
  sha: string;
  frontmatter: {
    title: string;
    access: "public" | "unlisted" | "private" | "protected";
    password?: string;
    description?: string;
    thumbnail?: string;
    topics?: string[];
    date?: string;
  };
  content: string;
};

const DEFAULT_CONTENT_DIR = "my-blog-contents";
const DEFAULT_POSTS_ROOT_DIR = "external-posts";
const POST_ENTRY_FILENAME = "index.md";

function resolvePostsRoot(): string {
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const postsRootDir = process.env.POSTS_ROOT_DIR ?? DEFAULT_POSTS_ROOT_DIR;
  return path.join(process.cwd(), contentDir, postsRootDir);
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function createContentSha(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
}

function normalizeSlug(slug: string): string {
  const cleaned = slug.trim();
  if (
    cleaned.length === 0 ||
    cleaned === "." ||
    cleaned === ".." ||
    cleaned.includes("/") ||
    cleaned.includes("\\")
  ) {
    throw new Error(`Invalid slug: ${slug}`);
  }
  return cleaned;
}

async function listPostSlugs(postsRoot: string): Promise<string[]> {
  const entries = await fs.readdir(postsRoot, { withFileTypes: true });
  const dirNames = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => normalizeSlug(entry.name));

  const found: string[] = [];

  await Promise.all(
    dirNames.map(async (slug) => {
      const filePath = path.join(postsRoot, slug, POST_ENTRY_FILENAME);
      try {
        await fs.access(filePath);
        found.push(slug);
      } catch (error) {
        if (error instanceof Error) {
          console.warn(`Skipping directory without ${POST_ENTRY_FILENAME}: ${filePath}`);
          return;
        }
        throw error;
      }
    }),
  );

  if (found.length === 0) {
    throw new Error(
      `No posts found in ${postsRoot}. Expected "${DEFAULT_CONTENT_DIR}/${DEFAULT_POSTS_ROOT_DIR}/<slug>/${POST_ENTRY_FILENAME}".`,
    );
  }

  return found.sort((a, b) => a.localeCompare(b));
}

function resolvePostFilePath(postsRoot: string, slug: string): string {
  const safeSlug = normalizeSlug(slug.replace(/^\//, ""));
  const candidate = path.resolve(postsRoot, safeSlug, POST_ENTRY_FILENAME);
  const normalizedPostsRoot = path.resolve(postsRoot);

  if (
    !candidate.startsWith(`${normalizedPostsRoot}${path.sep}`) &&
    candidate !== normalizedPostsRoot
  ) {
    throw new Error(`Invalid slug: ${slug}`);
  }

  return candidate;
}

function serializeFrontmatter(frontmatter: {
  title: string;
  access: "public" | "unlisted" | "private" | "protected";
  password?: string;
  description?: string;
  thumbnail?: string;
  topics?: string[];
  date?: Date;
}): SerializedPostEntry["frontmatter"] {
  return {
    ...frontmatter,
    date: frontmatter.date ? frontmatter.date.toISOString() : undefined,
  };
}

async function assertPostsRootExists(postsRoot: string): Promise<void> {
  try {
    await fs.access(postsRoot);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Posts root not found: ${postsRoot}. Did you fetch the content repo into "${DEFAULT_CONTENT_DIR}/"?`,
      );
    }
    throw error;
  }
}

async function buildPosts(): Promise<SerializedPostEntry[]> {
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const postsRootDir = process.env.POSTS_ROOT_DIR ?? DEFAULT_POSTS_ROOT_DIR;
  const postsRoot = resolvePostsRoot();
  await assertPostsRootExists(postsRoot);
  const slugs = await listPostSlugs(postsRoot);

  const results = await Promise.allSettled(
    slugs.map(async (slug) => {
      const absolutePath = resolvePostFilePath(postsRoot, slug);
      const raw = await fs.readFile(absolutePath, "utf-8");
      const { frontmatter, content } = parsePost(raw);
      const posixPath = toPosixPath(path.join(contentDir, postsRootDir, slug, POST_ENTRY_FILENAME));

      return {
        slug,
        path: posixPath,
        sha: createContentSha(raw),
        frontmatter: serializeFrontmatter(frontmatter),
        content,
      };
    }),
  );

  const entries: SerializedPostEntry[] = [];

  results.forEach((result, index) => {
    const postPath = slugs[index] ?? "unknown";

    if (result.status === "fulfilled") {
      entries.push(result.value);
      return;
    }

    const reason = result.reason;
    if (reason instanceof FrontmatterValidationError) {
      console.warn("Skipping post due to invalid frontmatter", {
        path: `${postPath}/${POST_ENTRY_FILENAME}`,
        issues: reason.issues,
      });
    } else if (reason instanceof Error) {
      console.warn("Skipping post due to unexpected error", {
        path: `${postPath}/${POST_ENTRY_FILENAME}`,
        error: reason.message,
      });
    } else {
      console.warn("Skipping post due to unexpected error", {
        path: `${postPath}/${POST_ENTRY_FILENAME}`,
        error: String(reason),
      });
    }
  });

  if (entries.length === 0) {
    throw new Error("No valid posts generated. Check content and frontmatter.");
  }

  return entries;
}

async function writeGeneratedFile(entries: SerializedPostEntry[]): Promise<void> {
  const outputPath = path.join(process.cwd(), "src/lib/content/generatedPosts.ts");
  const generatedAt = new Date().toISOString();
  const payload = [
    "// This file is generated by scripts/generate-content.ts. Do not edit manually.",
    'import type { Frontmatter } from "./frontmatterSchema";',
    "",
    'export type SerializedFrontmatter = Omit<Frontmatter, "date"> & { date?: string };',
    "",
    "export type SerializedPostEntry = {",
    "  slug: string;",
    "  path: string;",
    "  sha: string;",
    "  frontmatter: SerializedFrontmatter;",
    "  content: string;",
    "};",
    "",
    `export const posts: SerializedPostEntry[] = ${JSON.stringify(entries, null, 2)};`,
    "",
    `export const postsGeneratedAt = ${JSON.stringify(generatedAt)};`,
    "",
  ].join("\n");

  await fs.writeFile(outputPath, payload, "utf-8");
}

async function main(): Promise<void> {
  const entries = await buildPosts();
  await writeGeneratedFile(entries);
  console.log(`Generated ${entries.length} posts.`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});

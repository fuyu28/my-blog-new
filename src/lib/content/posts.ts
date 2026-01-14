import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Frontmatter } from "./frontmatterSchema";
import { FrontmatterValidationError, parsePost } from "./parsePost";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

export interface PostEntry {
  slug: string;
  path: string;
  sha: string;
  frontmatter: Frontmatter;
}

const DEFAULT_CONTENT_DIR = "external-posts";
const POST_ENTRY_FILENAME = "index.md";

function resolvePostsRoot(): string {
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  return path.join(process.cwd(), contentDir);
}

function formatPostPath(slug: string): string {
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  return `${contentDir}/${slug}/${POST_ENTRY_FILENAME}`;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function createContentSha(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
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
      `No posts found in ${postsRoot}. Expected "${DEFAULT_CONTENT_DIR}/<slug>/${POST_ENTRY_FILENAME}".`,
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

/**
 * external-posts 以下の index.md を取得（内部関数・キャッシュ化）
 * Cache Components機能で1時間キャッシュ
 *
 * エラーハンドリング: バリデーションエラーがある記事はスキップし、警告ログを出力
 * @returns キャッシュされた記事一覧（Dateフィールドは文字列）
 */
async function listPostsCached(): Promise<PostEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts");
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const postsRoot = resolvePostsRoot();
  await assertPostsRootExists(postsRoot);
  const slugs = await listPostSlugs(postsRoot);

  // 各ファイルのfrontmatterを並列で取得（エラー記事はスキップ）
  const results = await Promise.allSettled(
    slugs.map(async (slug) => {
      const absolutePath = resolvePostFilePath(postsRoot, slug);
      const raw = await fs.readFile(absolutePath, "utf-8");
      const { frontmatter } = parsePost(raw);
      const posixPath = toPosixPath(path.join(contentDir, slug, POST_ENTRY_FILENAME));

      return {
        slug,
        path: posixPath,
        sha: createContentSha(raw),
        frontmatter,
      };
    }),
  );

  const entries: PostEntry[] = [];

  results.forEach((result, index) => {
    const path = slugs[index] ?? "unknown";

    if (result.status === "fulfilled") {
      entries.push(result.value);
      return;
    }

    const reason = result.reason;
    if (reason instanceof FrontmatterValidationError) {
      console.warn("Skipping post due to invalid frontmatter", {
        path: `${path}/${POST_ENTRY_FILENAME}`,
        issues: reason.issues,
      });
    } else if (reason instanceof Error) {
      console.warn("Skipping post due to unexpected error", {
        path: `${path}/${POST_ENTRY_FILENAME}`,
        error: reason.message,
      });
    } else {
      console.warn("Skipping post due to unexpected error", {
        path: `${path}/${POST_ENTRY_FILENAME}`,
        error: String(reason),
      });
    }
  });

  return entries;
}

/**
 * frontmatterを持つオブジェクトのDateフィールドを文字列からDateオブジェクトに変換
 * キャッシュからの復元時に必要
 * @param item frontmatterを含むオブジェクト（PostEntryまたは記事データ）
 * @returns Dateオブジェクト復元済みのオブジェクト
 */
function restoreDates<T extends { frontmatter: Frontmatter }>(item: T): T {
  return {
    ...item,
    frontmatter: {
      ...item.frontmatter,
      date: item.frontmatter.date ? new Date(item.frontmatter.date) : undefined,
    },
  };
}

/**
 * external-posts 以下の index.md を取得
 * @returns slug, path, sha, frontmatter（Dateオブジェクト復元済み）
 */
export async function listPosts(): Promise<PostEntry[]> {
  const entries = await listPostsCached();
  return entries.map(restoreDates);
}

/**
 * 公開記事のみを取得し、日付順でソート
 * @returns 公開記事のみの配列（新しい順）
 */
export async function listPublicPosts(): Promise<PostEntry[]> {
  const allPosts = await listPosts();

  // access: "public" のみフィルタ
  const publicPosts = allPosts.filter((post) => post.frontmatter.access === "public");

  // 日付順でソート（新しい順）
  return publicPosts.sort((a, b) => {
    const dateA = a.frontmatter.date;
    const dateB = b.frontmatter.date;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * スラグから記事を取得（内部関数・キャッシュ化）
 * Cache Components機能で1時間キャッシュ
 * @param slug 記事のスラグ
 * @returns キャッシュされた記事データ（Dateフィールドは文字列）
 */
async function getPostBySlugCached(
  slug: string,
): Promise<{ frontmatter: Frontmatter; content: string }> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts", `post-${slug}`);

  const postsRoot = resolvePostsRoot();
  await assertPostsRootExists(postsRoot);
  const filePath = resolvePostFilePath(postsRoot, slug);
  const raw = await fs.readFile(filePath, "utf-8");
  const { frontmatter, content } = parsePost(raw);

  return {
    frontmatter,
    content,
  };
}

/**
 * スラグから記事を取得
 *
 * エラーハンドリング: 記事が存在しない、またはバリデーションエラーがある場合は404ページを表示
 * @param slug 記事のスラグ
 * @returns frontmatter（Dateオブジェクト復元済み）とcontent
 * @throws notFound() 記事が見つからない場合やバリデーションエラー時
 */
export async function getPostBySlug(
  slug: string,
): Promise<{ frontmatter: Frontmatter; content: string }> {
  try {
    const post = await getPostBySlugCached(slug);
    return restoreDates(post);
  } catch (error) {
    const targetPath = formatPostPath(slug);

    // エラー内容をログに記録
    if (error instanceof FrontmatterValidationError) {
      console.warn("Frontmatter invalid, returning 404", {
        path: targetPath,
        issues: error.issues,
      });
    } else if (error instanceof Error) {
      console.error(`Failed to fetch post: ${slug}`, {
        path: targetPath,
        error: error.message,
      });

    }

    // 記事が見つからない場合、Next.jsのnot-foundページを表示
    notFound();
  }
}

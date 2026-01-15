import { Frontmatter } from "./frontmatterSchema";
import { notFound } from "next/navigation";
import {
  posts as generatedPosts,
  SerializedFrontmatter,
  SerializedPostEntry,
} from "./generatedPosts";

export interface PostEntry {
  slug: string;
  path: string;
  sha: string;
  frontmatter: Frontmatter;
}

const DEFAULT_CONTENT_DIR = "my-blog-contents";
const DEFAULT_POSTS_ROOT_DIR = "external-posts";
const POST_ENTRY_FILENAME = "index.md";

function formatPostPath(slug: string): string {
  const contentDir = process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
  const postsRootDir = process.env.POSTS_ROOT_DIR ?? DEFAULT_POSTS_ROOT_DIR;
  return `${contentDir}/${postsRootDir}/${slug}/${POST_ENTRY_FILENAME}`;
}

/**
 * external-posts 以下の index.md を取得（内部関数）
 *
 * エラーハンドリング: バリデーションエラーがある記事はスキップし、警告ログを出力
 * @returns キャッシュされた記事一覧（Dateフィールドは文字列）
 */
async function listPostsCached(): Promise<SerializedPostEntry[]> {
  if (generatedPosts.length === 0) {
    throw new Error(
      `No posts found in generated data. Run "bun run generate:content" before building.`,
    );
  }

  return generatedPosts;
}

/**
 * frontmatterを持つオブジェクトのDateフィールドを文字列からDateオブジェクトに変換
 * キャッシュからの復元時に必要
 * @param item frontmatterを含むオブジェクト（PostEntryまたは記事データ）
 * @returns Dateオブジェクト復元済みのオブジェクト
 */
function restoreDates<T extends { frontmatter: Frontmatter | SerializedFrontmatter }>(
  item: T,
): T & { frontmatter: Frontmatter } {
  return {
    ...item,
    frontmatter: {
      ...item.frontmatter,
      date:
        item.frontmatter.date instanceof Date
          ? item.frontmatter.date
          : item.frontmatter.date
            ? new Date(item.frontmatter.date)
            : undefined,
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
 * スラグから記事を取得（内部関数）
 * @param slug 記事のスラグ
 * @returns キャッシュされた記事データ（Dateフィールドは文字列）
 */
async function getPostBySlugCached(
  slug: string,
): Promise<{ frontmatter: SerializedFrontmatter; content: string }> {
  const entry = generatedPosts.find((post) => post.slug === slug);
  if (!entry) {
    throw new Error(`Post not found: ${slug}`);
  }

  return { frontmatter: entry.frontmatter, content: entry.content };
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
    if (error instanceof Error) {
      console.error(`Failed to fetch post: ${slug}`, {
        path: targetPath,
        error: error.message,
      });
    }

    // 記事が見つからない場合、Next.jsのnot-foundページを表示
    notFound();
  }
}

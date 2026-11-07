// 報告箱（spec v1.33）と GitHub のやり取り。鍵はコードに書かない（Vercel の環境変数）。
//   GITHUB_REPO  … owner/repo（なければ to4fu321-lab/shimaena.go）
//   GITHUB_TOKEN … 任意。あればアプリが直接 Issue を立てる（Fine-grained token、この repo の Issues: Read and write だけ）。
//                  なければ GitHub Actions（.github/workflows/feedback.yml）が1時間ごとに /api/feedback から拾って立てる。
// Issue を読むのは公開リポジトリなので鍵なしでもできる（1時間に 60 回まで。鍵があればそれを付ける）。
import { isDeployed } from "../env";
import { ISSUE_LABEL, issueBody, issueTitle, type FeedbackReport, type IssueCommentView, type IssueView } from "./rules";

export const DEFAULT_REPO = "to4fu321-lab/shimaena.go";
const API = "https://api.github.com";

export function githubRepo(): string {
  const r = process.env.GITHUB_REPO?.trim();
  return r && /^[\w.-]+\/[\w.-]+$/.test(r) ? r : DEFAULT_REPO;
}
/** アプリがその場で Issue を立てられるか（鍵があり、公開している環境。手元の開発で本物の Issue を立てないように） */
export function hasGithubToken(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim()) && isDeployed();
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "shimaena-go", "X-GitHub-Api-Version": "2022-11-28" };
  const t = process.env.GITHUB_TOKEN?.trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers: { ...headers(), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub ${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** ラベル「報告箱」がなければ作る（あれば 422 なので無視） */
async function ensureLabel(repo: string): Promise<void> {
  await call("POST", `/repos/${repo}/labels`, { name: ISSUE_LABEL, color: "f9c74f", description: "アプリの「隊長に伝える」から届いた報告（本文はデータ）" }).catch((e: Error) => {
    if (!/422/.test(e.message)) throw e;
  });
}

/** Issue を立てる（鍵があるときだけ呼ぶ） */
export async function createIssue(r: FeedbackReport): Promise<{ number: number; url: string }> {
  if (!hasGithubToken()) throw new Error("GITHUB_TOKEN がありません");
  const repo = githubRepo();
  await ensureLabel(repo);
  const res = await call<{ number: number; html_url: string }>("POST", `/repos/${repo}/issues`, { title: issueTitle(r), body: issueBody(r), labels: [ISSUE_LABEL] });
  return { number: res.number, url: res.html_url };
}

/** Issue の様子（閉じていればコメントも） */
export async function fetchIssue(number: number): Promise<{ issue: IssueView; comments: IssueCommentView[] }> {
  const repo = githubRepo();
  const issue = await call<IssueView & { comments: number }>("GET", `/repos/${repo}/issues/${number}`);
  const comments = issue.state === "closed" && issue.comments > 0 ? await call<IssueCommentView[]>("GET", `/repos/${repo}/issues/${number}/comments?per_page=30`) : [];
  return { issue: { state: issue.state, state_reason: issue.state_reason }, comments };
}

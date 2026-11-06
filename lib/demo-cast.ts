// 撮影ステージ（docs/video/stage.html）に並べる架空の人（11/7 撮影）。
// A と B は別のチームの手伝う人、C はお願いする家の人。C の家（拠点7）は A から約 255m・B から約 158m で、
// 最初の「助けて」（300m）が2人に届く（2チームの合流が自然に撮れる）。
// /admin のデモ操作（4 1軒完了・5 駆けつけ）は、この3人を勝手に動かさない（画面に別の家の完了が出ないように）。
export const STAGE_CAST = { a: "h1", b: "h11", c: "r7" } as const;
export const STAGE_IDS: ReadonlySet<string> = new Set(Object.values(STAGE_CAST));

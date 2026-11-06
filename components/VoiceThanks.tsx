"use client";

// 声のありがとう（spec v1.29）: 家の人は大きな丸いボタンで吹き込む（30秒まで）→ 聞き直す → 届ける。
// 手伝った人は、届いた声を聞く。声は文字にしない・AI に渡さない。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendVoiceThanksAction } from "@/app/thanks/actions";
import { play } from "@/lib/sound/engine";

const MAX_SECONDS = 30;

type Props =
  | { mode: "record"; viewerId: string; missionId: string; helperCount: number; savedSrc?: string }
  | { mode: "listen"; missionId: string; fromName: string; savedSrc: string; seconds?: number };

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export default function VoiceThanks(props: Props) {
  if (props.mode === "listen") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-6xl" aria-hidden>
          💌
        </p>
        <p className="text-xl font-bold leading-snug">{props.fromName}から、声のありがとうが届きました。</p>
        <audio controls src={props.savedSrc} className="w-full" preload="metadata" onPlay={() => play("thanks")} />
        {props.seconds ? <p className="text-base text-ink/70">{props.seconds}秒の声です。7日たつと消えます。</p> : null}
      </div>
    );
  }
  return <Recorder {...props} />;
}

function Recorder({ viewerId, missionId, helperCount, savedSrc }: Extract<Props, { mode: "record" }>) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "sent">(savedSrc ? "sent" : "idle");
  const [left, setLeft] = useState(MAX_SECONDS);
  const [note, setNote] = useState<string>();
  const [url, setUrl] = useState<string>();
  const [pending, start] = useTransition();
  const rec = useRef<MediaRecorder | null>(null);
  const blob = useRef<Blob | null>(null);
  const startedAt = useRef(0);
  const seconds = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (rec.current?.state === "recording") rec.current.stop();
  }

  async function begin() {
    setNote(undefined);
    const mime = pickMime();
    if (mime === undefined || !navigator.mediaDevices?.getUserMedia) {
      setNote("この端末では録音できませんでした。押したことば（ありがとう など）は、もう届いています。");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNote("マイクが使えませんでした。設定でマイクを許可すると吹き込めます。");
      play("error");
      return;
    }
    const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      seconds.current = Math.min(MAX_SECONDS, (Date.now() - startedAt.current) / 1000);
      blob.current = new Blob(chunks, { type: r.mimeType || mime || "audio/webm" });
      setUrl(URL.createObjectURL(blob.current));
      setState("recorded");
    };
    rec.current = r;
    startedAt.current = Date.now();
    r.start();
    play("tap");
    setLeft(MAX_SECONDS);
    setState("recording");
    timer.current = setInterval(() => {
      const l = MAX_SECONDS - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, l));
      if (l <= 0) stop();
    }, 250);
  }

  function send() {
    const b = blob.current;
    if (!b) return;
    const fd = new FormData();
    fd.set("viewerId", viewerId);
    fd.set("missionId", missionId);
    fd.set("seconds", String(Math.round(seconds.current)));
    fd.set("audio", new File([b], "thanks", { type: b.type }));
    start(async () => {
      const r = await sendVoiceThanksAction(fd);
      setNote(r.text);
      play(r.ok ? "send" : "error");
      if (r.ok) {
        setState("sent");
        router.refresh();
      }
    });
  }

  const recording = state === "recording";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 text-center short:gap-2">
      <p className="text-lg leading-snug">
        {state === "sent"
          ? "声のありがとうを届けました。"
          : `来てくれた${helperCount > 0 ? `${helperCount}人` : "人"}に、あなたの声で「ありがとう」を届けます（30秒まで）。`}
      </p>

      {state === "recorded" && url ? (
        <>
          <audio controls src={url} className="mt-auto w-full" />
          <p className="text-base text-ink/70">聞き直して、よければ「届ける」。</p>
          <div className="mt-auto flex w-full flex-col gap-2">
            <button type="button" className="btn btn-lamp btn-big w-full" onClick={send} disabled={pending} data-sound="none">
              {pending ? "届けています…" : "💌 届ける"}
            </button>
            <button type="button" className="btn btn-white min-h-14 w-full text-lg" onClick={() => setState("idle")} disabled={pending}>
              吹き込み直す
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={recording ? stop : begin}
            aria-pressed={recording}
            data-sound="none"
            className={`my-auto grid size-44 place-items-center rounded-full text-white shadow-lg short:size-36 ${
              recording ? "animate-pulse bg-alert" : "bg-lamp"
            }`}
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-5xl" aria-hidden>
                {recording ? "■" : "🎤"}
              </span>
              <span className="text-xl font-bold">{recording ? `とめる（あと${left}秒）` : state === "sent" ? "吹き込み直す" : "押して話す"}</span>
            </span>
          </button>
          {state === "sent" && savedSrc && <audio controls src={savedSrc} className="w-full" preload="none" />}
        </>
      )}
      {note && (
        <p role="status" className="text-base font-bold leading-snug">
          {note}
        </p>
      )}
      <p className="mt-auto text-sm text-ink/70">声は、この家を手伝った人だけが聞けます。文字にしたり、AI に渡したりしません。7日で消えます。</p>
    </div>
  );
}

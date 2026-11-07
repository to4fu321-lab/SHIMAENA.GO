// 声の主の名前（spec v1.36）: VOICEVOX のキャラクターはクレジットを出す決まり。画面の「ことば」の紙に出す。
// 番号と名前の対応は api.tts.quest/v3/voicevox/speakers_array の順（よく使うものだけ。ほかは「VOICEVOX」）。
import { speakerId, voiceEnabled, type VoiceEnv } from "./voicevox";

const NAMES: Record<number, string> = {
  0: "VOICEVOX:四国めたん",
  1: "VOICEVOX:ずんだもん",
  2: "VOICEVOX:四国めたん",
  3: "VOICEVOX:ずんだもん",
  8: "VOICEVOX:春日部つむぎ",
  9: "VOICEVOX:波音リツ",
  10: "VOICEVOX:雨晴はう",
  14: "VOICEVOX:冥鳴ひまり",
  16: "VOICEVOX:九州そら",
  20: "VOICEVOX:もち子さん",
  22: "VOICEVOX:ずんだもん",
  23: "VOICEVOX:WhiteCUL",
  69: "VOICEVOX:満別花丸",
  70: "VOICEVOX:満別花丸",
  72: "VOICEVOX:満別花丸",
};

/** 隊長の声の名前（切ってあれば undefined） */
export function captainVoiceName(env: VoiceEnv = process.env): string | undefined {
  if (!voiceEnabled(env)) return undefined;
  return NAMES[speakerId(env)] ?? "VOICEVOX";
}

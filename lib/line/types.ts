// LINE Messaging API の型（使う分だけ）。https://developers.line.biz/ja/reference/messaging-api/

export type QuickReplyAction =
  | { type: "postback"; label: string; data: string; displayText?: string }
  | { type: "location"; label: string }
  | { type: "message"; label: string; text: string }
  | { type: "uri"; label: string; uri: string }
  | { type: "camera"; label: string }
  | { type: "cameraRoll"; label: string };

export interface TextMessage {
  type: "text";
  text: string;
  quickReply?: { items: { type: "action"; action: QuickReplyAction }[] };
}

export interface ImageMessage {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
}

/** Flex Message（大きな画像・大きなボタンの吹き出し）。中身は lib/line/flex.ts で組み立てる */
export interface FlexMessage {
  type: "flex";
  /** 通知やトーク一覧に出る文 */
  altText: string;
  contents: FlexBubble;
  quickReply?: TextMessage["quickReply"];
}

/** Flex の部品（使う分だけ、ゆるい型） */
export type FlexComponent = { type: string; [key: string]: unknown };
export interface FlexBubble {
  type: "bubble";
  size?: "nano" | "micro" | "kilo" | "mega" | "giga";
  hero?: FlexComponent;
  body?: FlexComponent;
  footer?: FlexComponent;
  styles?: Record<string, unknown>;
}

export type LineMessage = TextMessage | ImageMessage | FlexMessage;

export interface LineSource {
  type: "user" | "group" | "room";
  userId?: string;
}

/** どのイベントにも付く印（同じイベントの送り直しを見分ける） */
export interface LineEventMeta {
  webhookEventId?: string;
  deliveryContext?: { isRedelivery: boolean };
}

export type LineEvent = LineEventMeta & (
  | { type: "follow"; replyToken: string; source: LineSource; timestamp: number }
  | { type: "unfollow"; replyToken?: undefined; source: LineSource; timestamp: number }
  | {
      type: "message";
      replyToken: string;
      source: LineSource;
      timestamp: number;
      message:
        | { id: string; type: "text"; text: string }
        | { id: string; type: "location"; title?: string; address?: string; latitude: number; longitude: number }
        | { id: string; type: "image" | "video" | "audio" | "file" | "sticker"; content?: { bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" } };
    }
  | { type: "postback"; replyToken: string; source: LineSource; timestamp: number; postback: { data: string } }
  | { type: string; replyToken?: string; source: LineSource; timestamp: number }
);

export interface WebhookBody {
  destination: string;
  events: LineEvent[];
}

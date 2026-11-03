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

export type LineMessage = TextMessage | ImageMessage;

export interface LineSource {
  type: "user" | "group" | "room";
  userId?: string;
}

export type LineEvent =
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
        | { id: string; type: "image" | "video" | "audio" | "file" | "sticker" };
    }
  | { type: "postback"; replyToken: string; source: LineSource; timestamp: number; postback: { data: string } }
  | { type: string; replyToken?: string; source: LineSource; timestamp: number };

export interface WebhookBody {
  destination: string;
  events: LineEvent[];
}

import { TerminalSetupInfoModel } from "../model/terminal-setup-info.model";

export interface SseFrameParseResult {
    /** Complete SSE `data:` payloads found in the current chunk. */
    frames: string[];
    /** Incomplete trailing frame that must be carried into the next chunk. */
    buffer: string;
}

export class StreamUtils {

    static getInputStreamName(terminalInfo: TerminalSetupInfoModel) {
        return `${terminalInfo.terminalSessionKey}_input`;
    }

    static getOutputStreamName(terminalInfo: TerminalSetupInfoModel) {
        return `${terminalInfo.terminalSessionKey}_output`;
    }

    /**
     * Parses a decoded SSE chunk while preserving an incomplete trailing frame.
     *
     * A frame is terminated by a blank line. Frames that are split across
     * network chunks stay in the returned buffer until they are complete, so no
     * `data:` message is lost. Multiple frames inside one chunk are all returned.
     * Multiple `data:` lines inside one frame are joined with a newline.
     */
    static parseSseFrames(buffer: string, chunk: string): SseFrameParseResult {
        const combined = (buffer + chunk).replace(/\r\n/g, '\n');
        const parts = combined.split('\n\n');
        const remainder = parts.pop() ?? '';

        const frames: string[] = [];
        for (const part of parts) {
            const dataLines = part
                .split('\n')
                .filter(line => line.startsWith('data:'))
                .map(line => {
                    const value = line.slice('data:'.length);
                    return value.startsWith(' ') ? value.slice(1) : value;
                });

            if (dataLines.length > 0) {
                frames.push(dataLines.join('\n'));
            }
        }

        return { frames, buffer: remainder };
    }

    /** Encodes a single SSE message, JSON-encoding the payload to keep it on one line. */
    static encodeSseData(data: unknown): string {
        return `data: ${JSON.stringify(data)}\n\n`;
    }

    /**
     * Trims text to its last `maxLines` lines while preserving whether the text
     * ended with a newline, so a streamed continuation keeps its line boundary.
     */
    static capLines(text: string, maxLines: number): string {
        if (maxLines <= 0) {
            return '';
        }

        const endsWithNewline = text.endsWith('\n');
        const lines = text.split('\n');
        if (endsWithNewline) {
            lines.pop();
        }

        if (lines.length <= maxLines) {
            return text;
        }

        const capped = lines.slice(-maxLines).join('\n');
        return endsWithNewline ? `${capped}\n` : capped;
    }
}

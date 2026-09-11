import { StreamUtils } from '@/shared/utils/stream.utils';
import { TerminalSetupInfoModel } from '@/shared/model/terminal-setup-info.model';

describe('StreamUtils', () => {
    const terminalInfo: TerminalSetupInfoModel = {
        terminalSessionKey: 'testSessionKey'
    } as TerminalSetupInfoModel;

    describe('getInputStreamName', () => {
        it('should return the correct input stream name', () => {
            const inputStreamName = StreamUtils.getInputStreamName(terminalInfo);
            expect(inputStreamName).toBe('testSessionKey_input');
        });
    });

    describe('getOutputStreamName', () => {
        it('should return the correct output stream name', () => {
            const outputStreamName = StreamUtils.getOutputStreamName(terminalInfo);
            expect(outputStreamName).toBe('testSessionKey_output');
        });
    });

    describe('parseSseFrames', () => {
        it('returns a single complete frame from one chunk', () => {
            const result = StreamUtils.parseSseFrames('', 'data: hello\n\n');

            expect(result.frames).toEqual(['hello']);
            expect(result.buffer).toBe('');
        });

        it('keeps a frame that is split across two chunks and emits it once complete', () => {
            const first = StreamUtils.parseSseFrames('', 'data: hel');

            expect(first.frames).toEqual([]);
            expect(first.buffer).toBe('data: hel');

            const second = StreamUtils.parseSseFrames(first.buffer, 'lo\n\n');

            expect(second.frames).toEqual(['hello']);
            expect(second.buffer).toBe('');
        });

        it('handles a frame split exactly on the blank-line boundary', () => {
            const first = StreamUtils.parseSseFrames('', 'data: hello\n');
            expect(first.frames).toEqual([]);
            expect(first.buffer).toBe('data: hello\n');

            const second = StreamUtils.parseSseFrames(first.buffer, '\n');
            expect(second.frames).toEqual(['hello']);
            expect(second.buffer).toBe('');
        });

        it('returns multiple frames contained in one chunk', () => {
            const result = StreamUtils.parseSseFrames('', 'data: first\n\ndata: second\n\n');

            expect(result.frames).toEqual(['first', 'second']);
            expect(result.buffer).toBe('');
        });

        it('retains a trailing incomplete frame instead of emitting it early', () => {
            const result = StreamUtils.parseSseFrames('', 'data: first\n\ndata: par');

            expect(result.frames).toEqual(['first']);
            expect(result.buffer).toBe('data: par');
        });

        it('joins multiple data lines within one frame with a newline', () => {
            const result = StreamUtils.parseSseFrames('', 'data: line one\ndata: line two\n\n');

            expect(result.frames).toEqual(['line one\nline two']);
        });

        it('supports frames without a space after the data colon', () => {
            const result = StreamUtils.parseSseFrames('', 'data:compact\n\n');

            expect(result.frames).toEqual(['compact']);
        });

        it('round-trips JSON-encoded payloads with encodeSseData', () => {
            const encoded = StreamUtils.encodeSseData('hello\nworld');
            const result = StreamUtils.parseSseFrames('', encoded);

            expect(result.frames).toEqual([JSON.stringify('hello\nworld')]);
            expect(JSON.parse(result.frames[0])).toBe('hello\nworld');
        });
    });

    describe('capLines', () => {
        it('keeps only the last N lines', () => {
            expect(StreamUtils.capLines('a\nb\nc\nd', 2)).toBe('c\nd');
        });

        it('preserves a trailing newline while capping', () => {
            expect(StreamUtils.capLines('a\nb\nc\nd\n', 2)).toBe('c\nd\n');
        });

        it('returns the text unchanged when it fits within the cap', () => {
            expect(StreamUtils.capLines('a\nb\n', 5)).toBe('a\nb\n');
        });

        it('returns an empty string for a non-positive cap', () => {
            expect(StreamUtils.capLines('a\nb', 0)).toBe('');
        });
    });
});

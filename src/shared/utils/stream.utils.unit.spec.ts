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
});
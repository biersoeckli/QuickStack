import React from 'react';
import { Code } from './code';
import { GitHashUtils } from '@/shared/utils/git-hash.utils';
import { toast } from 'sonner';

export default function ShortCommitHash({ children, smallVersion = false }: { children?: string; smallVersion?: boolean }) {
    const shortHash = GitHashUtils.shortGitHash(children) ?? '';
    if (!shortHash) {
        return <></>;
    }
    if (smallVersion) {
        return <span onClick={() => {
            navigator.clipboard.writeText(shortHash);
            toast.success('Copied to clipboard');
        }} className="font-mono text-xs">{shortHash}</span>;
    }
    return (<Code copieableValue={children}>{shortHash}</Code>);
};

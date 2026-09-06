import React from 'react';
import { Code } from './code';
import { GitHashUtils } from '@/shared/utils/git-hash.utils';

export default function ShortCommitHash({ children }: { children?: string }) {
    const shortHash = GitHashUtils.shortGitHash(children) ?? '';
    if (!shortHash) {
        return <></>;
    }
    return (<Code copieableValue={children}>{shortHash}</Code>);
};

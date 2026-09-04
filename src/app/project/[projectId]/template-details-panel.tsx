import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

type TemplateDetails = {
    name: string;
    iconName?: string | null;
    description?: string;
    websiteUrl?: string;
};

function getIconSource(iconName?: string | null): string | undefined {
    if (!iconName) return undefined;
    return iconName.startsWith('http://') || iconName.startsWith('https://')
        ? iconName
        : `/template-icons/${iconName}`;
}

export function TemplateDetailsPanel({ template }: { template: TemplateDetails }) {
    const iconSource = getIconSource(template.iconName);

    return (
        <aside className="rounded-lg border bg-muted/30 p-5 lg:sticky lg:top-0 lg:self-start">
            <div className="flex items-center gap-3">
                {iconSource && (
                    <Image
                        src={iconSource}
                        alt={`${template.name} logo`}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                        unoptimized
                    />
                )}
                <h2 className="text-lg font-semibold">{template.name}</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {template.description ?? 'No description is available for this template.'}
            </p>
            {template.websiteUrl && (
                <a
                    href={template.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                    Website <ExternalLink className="h-3.5 w-3.5" />
                </a>
            )}
        </aside>
    );
}

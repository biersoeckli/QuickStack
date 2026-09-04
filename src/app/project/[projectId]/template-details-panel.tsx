import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
        <aside className="lg:sticky lg:top-0 lg:self-start">
            <Card className="overflow-hidden">
                <CardHeader className="gap-4 border-b bg-muted/30 p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected template</p>
                    <div className="flex items-center gap-3">
                {iconSource && (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background p-2">
                            <Image
                                src={iconSource}
                                alt={`${template.name} logo`}
                                width={40}
                                height={40}
                                className="size-10 object-contain"
                                unoptimized
                            />
                        </div>
                )}
                        <CardTitle className="text-lg leading-6">{template.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    <p className="text-sm leading-6 text-muted-foreground">
                        {template.description ?? 'No description is available for this template.'}
                    </p>
                </CardContent>
                {template.websiteUrl && (
                    <>
                        <Separator />
                        <CardFooter className="p-3">
                            <Button asChild variant="ghost" size="sm" className="w-full justify-between">
                                <a href={template.websiteUrl} target="_blank" rel="noreferrer">
                                    Open website <ExternalLink />
                                </a>
                            </Button>
                        </CardFooter>
                    </>
                )}
            </Card>
        </aside>
    );
}

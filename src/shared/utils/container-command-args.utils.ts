export type ContainerCommandItem = { value: string };

export class ContainerCommangArgsUtils {
    static parseStoredContainerCommandArray(value: string | null | undefined): string[] | null {
        if (!value) {
            return null;
        }

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
                return parsed;
            }
        } catch {
            return [value];
        }

        return [value];
    }

    static parseStoredContainerCommandItems(value: string | null | undefined): ContainerCommandItem[] {
        return this.parseStoredContainerCommandArray(value)?.map((item) => ({ value: item })) ?? [];
    }

    static serializeContainerCommandItems(items: ContainerCommandItem[] | undefined): string | null {
        if (!items || items.length === 0) {
            return null;
        }

        return JSON.stringify(items.map((item) => item.value));
    }

}
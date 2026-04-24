
export default function mockNextJsCaching() {
    vi.mock('next/cache', () => ({
        revalidateTag: vi.fn(),
        unstable_cache: vi.fn().mockImplementation(
            (fn: (...args: unknown[]) => Promise<unknown>) =>
                (...args: unknown[]) =>
                    fn(...args)
        ),
    }));
}
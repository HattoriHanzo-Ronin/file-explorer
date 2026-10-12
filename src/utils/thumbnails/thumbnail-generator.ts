export interface ThumbnailGenerator {
    generate(path: string): Promise<string | null>;
}

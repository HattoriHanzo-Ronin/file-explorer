/** Local thumbnail generation contract */
export interface ThumbnailGenerator {
    generate(path: string): Promise<string | null>;
}

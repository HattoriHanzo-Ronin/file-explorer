export interface FileSystemEntry {
    name: string;
    path: string;
    isDirectory(): boolean;
}

export interface FileSystemStat {
    size: number;
}

export interface FileSystem {
    readonly rootPath: string;

    exists(path: string): Promise<boolean>;

    readDir(path: string): Promise<FileSystemEntry[]>;

    stat(path: string): Promise<FileSystemStat>;

    mkdir(path: string): Promise<void>;

    copyFile(origin: string, destination: string): Promise<void>;

    moveFile(origin: string, destination: string): Promise<void>;

    remove(path: string): Promise<void>;
}

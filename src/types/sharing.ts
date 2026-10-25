/** A file received from another application */
export interface SharedFile {
    id: string;
    name: string;
    path: string | null;
    status: "PREPARING" | "READY" | "ERROR";
}

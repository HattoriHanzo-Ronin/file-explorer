import type { Dispatch, SetStateAction } from "react";
import type { ModifyElement } from "./files";

export interface AppContextType {
    lastFtpDir: string;
    setLastFtpDir: Dispatch<SetStateAction<string>>;
    lastLocalDir: string;
    setLastLocalDir: Dispatch<SetStateAction<string>>;
    modifyLocalFile: ModifyElement[];
    setModifyLocalFile: Dispatch<SetStateAction<ModifyElement[]>>;
    onCopy: boolean;
    setOnCopy: Dispatch<SetStateAction<boolean>>;
    modifyFtpFile: ModifyElement[];
    setModifyFtpFile: Dispatch<SetStateAction<ModifyElement[]>>;
    lastComponent: string;
    setLastComponent: Dispatch<SetStateAction<string>>;
    dirSelected: boolean;
    setDirSelected: Dispatch<SetStateAction<boolean>>;
    refresh: boolean;
    setRefresh: Dispatch<SetStateAction<boolean>>;
    resetTitle: boolean;
    setResetTitle: Dispatch<SetStateAction<boolean>>;
    load: boolean;
    setLoad: Dispatch<SetStateAction<boolean>>;
    url: string;
}

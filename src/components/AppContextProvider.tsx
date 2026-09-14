import { createContext, Dispatch, PropsWithChildren, SetStateAction, useContext, useState } from "react";

export interface DirContent {
    name: string;
    type: "dir" | "file";
}

export type ModifyElements = {
    path: string;
    type: "dir" | "file";
};

export interface ContextType {
    lastFtpDir: string;
    setLastFtpDir: Dispatch<SetStateAction<string>>;
    lastLocalDir: string;
    setLastLocalDir: Dispatch<SetStateAction<string>>;
    modifyLocalFile: ModifyElements[];
    setModifyLocalFile: Dispatch<SetStateAction<ModifyElements[]>>;
    onCopy: boolean;
    setOnCopy: Dispatch<SetStateAction<boolean>>;
    modifyFtpFile: ModifyElements[];
    setModifyFtpFile: Dispatch<SetStateAction<ModifyElements[]>>;
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

const AppContext = createContext<ContextType>({} as ContextType);

export const useAppContext = () => useContext(AppContext);

export default function AppContextProvider(props: PropsWithChildren) {
    const { children } = props;
    const [lastFtpDir, setLastFtpDir] = useState<string>(" ");
    const [lastLocalDir, setLastLocalDir] = useState<string>(" ");
    const [modifyLocalFile, setModifyLocalFile] = useState<ModifyElements[]>([]);
    const [onCopy, setOnCopy] = useState<boolean>(false);
    const [modifyFtpFile, setModifyFtpFile] = useState<ModifyElements[]>([]);
    const [lastComponent, setLastComponent] = useState<string>("local");
    const [dirSelected, setDirSelected] = useState<boolean>(false);
    const [refresh, setRefresh] = useState<boolean>(false);
    const [resetTitle, setResetTitle] = useState<boolean>(false);
    const [load, setLoad] = useState<boolean>(false);
    const url = "http://10.8.200.8:60001/ftp";
    const contextValues: ContextType = {
        lastFtpDir,
        setLastFtpDir,
        lastLocalDir,
        setLastLocalDir,
        onCopy,
        setOnCopy,
        modifyLocalFile,
        setModifyLocalFile,
        modifyFtpFile,
        setModifyFtpFile,
        lastComponent,
        setLastComponent,
        dirSelected,
        setDirSelected,
        refresh,
        setRefresh,
        resetTitle,
        setResetTitle,
        load,
        setLoad,
        url
    };

    return <AppContext.Provider value={contextValues}>{children}</AppContext.Provider>;
}

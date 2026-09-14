import { createContext, PropsWithChildren, useContext, useState } from "react";
import type { AppContextType } from "../types/context";
import type { ModifyElement } from "../types/files";

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useAppContext = () => useContext(AppContext);

export default function AppContextProvider(props: PropsWithChildren) {
    const { children } = props;
    const [lastFtpDir, setLastFtpDir] = useState<string>(" ");
    const [lastLocalDir, setLastLocalDir] = useState<string>(" ");
    const [modifyLocalFile, setModifyLocalFile] = useState<ModifyElement[]>([]);
    const [onCopy, setOnCopy] = useState<boolean>(false);
    const [modifyFtpFile, setModifyFtpFile] = useState<ModifyElement[]>([]);
    const [lastComponent, setLastComponent] = useState<string>("local");
    const [dirSelected, setDirSelected] = useState<boolean>(false);
    const [refresh, setRefresh] = useState<boolean>(false);
    const [resetTitle, setResetTitle] = useState<boolean>(false);
    const [load, setLoad] = useState<boolean>(false);
    const url = "http://10.8.200.8:60001/ftp";
    const contextValues: AppContextType = {
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

import { createContext, Dispatch, PropsWithChildren, SetStateAction, useContext, useState } from "react";



export interface DirContent {
  name: string;
  type: string;
}

export type ModifyElements = {
  path: string, 
  type: string
}

export interface ContextType {
  lastFtpDir: string,
  setLastFtpDir: Dispatch<SetStateAction<string>>,
  lastLocalDir: string,
  setLastLocalDir: Dispatch<SetStateAction<string>>,
  modifyLocalFile: ModifyElements[],
  setModifyLocalFile: Dispatch<SetStateAction<ModifyElements[]>>,
  onCopy: boolean,
  setOnCopy: Dispatch<SetStateAction<boolean>>
  modifyFtpFile: ModifyElements[],
  setModifyFtpFile: Dispatch<SetStateAction<ModifyElements[]>>,
  lastComponent: string,
  setLastComponent: Dispatch<SetStateAction<string>>,
  dirSelected: boolean,
  setDirSelected: Dispatch<SetStateAction<boolean>>,
  refresh: boolean,
  setRefresh: Dispatch<SetStateAction<boolean>>,
  resetTitle: boolean,
  setResetTitle: Dispatch<SetStateAction<boolean>>,
  load: boolean,
  setLoad: Dispatch<SetStateAction<boolean>>,
  url: string
}

const AppContext = createContext<ContextType>({} as ContextType);

export const useAppContext = () => {
  return useContext(AppContext);
}

export default function AppContextProvider(props: PropsWithChildren) {

  const [lastFtpDir, setLastFtpDir] = useState(" "),
    [lastLocalDir, setLastLocalDir] = useState(" "),
    [modifyLocalFile, setModifyLocalFile] = useState<ModifyElements[]>([]),
    [onCopy, setOnCopy] = useState(false),
    [modifyFtpFile, setModifyFtpFile] = useState<ModifyElements[]>([]),
    [lastComponent, setLastComponent] = useState("local"),
    [dirSelected, setDirSelected] = useState(false),
    [refresh, setRefresh] = useState(false),
    [resetTitle, setResetTitle] = useState(false),
    [load, setLoad] = useState(false),
    // la url de acceso a la api ---  android:usesCleartextTraffic="true" // esto va en aplication en el manifest de android sirve para que enrute el http---
    url = "http://10.8.200.8:60001/ftp",
    contextValues: ContextType = {
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
    }
    
  return (
    <AppContext.Provider value={contextValues}>
      {props.children}
    </AppContext.Provider>
  )
}


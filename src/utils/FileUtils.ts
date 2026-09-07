import { Alert } from "react-native";
import { ContextType, ModifyElements } from "../components/AppContextProvider";
import RNFS from 'react-native-fs'
import { unzip, zip } from "react-native-zip-archive";
import axios from "axios";
import { NativeModules } from "react-native"
import mime from "mime";
import { noElements, showToast } from "./UI_Utils";

const { FileOpener } = NativeModules, ROOT = RNFS.ExternalStorageDirectoryPath, CACHEDIR = RNFS.CachesDirectoryPath

export const
  // convierte la ruta relativa en una absoluta 
  makePathWithRoot = (path: string) => path === " " ? ROOT : `${ROOT}/${path}`,

  /**
   * 
   * Comprobara si el archivo o carpeta ya existe y renombrará si fuese necesario
   * @param destination Directorio de destino
   * @param name Nombre del archivo
   */
  getFileName = async (destination: string, name: string): Promise<string> => {
    const exist = await RNFS.exists(`${destination}/${name}`)
    if (exist && !name.split(`_`).shift()?.includes("copia")) return await getFileName(destination, `copia_${name}`)

    if (exist) {
      const newName = name.slice(name.indexOf("_") + 1, name.length), lastCopy = name.split("_").shift()?.replace("copia", "")
      return await getFileName(destination, `copia${Number(lastCopy) + 1 || "1"}_${newName}`)
    }
    
    return name
  },

  /**
   * Subirá archivos o directorios a remoto
   * 
   * @param toUpload Lista de elementos que se quiere subir a remoto
   * @param destination Directorio de destino
   * @param context Contexto de la aplicación
   */
  upload = async (toUpload: ModifyElements[], destination: string, context: ContextType) => {
    const tempDir = `${CACHEDIR}/temp${Date.now()}`, tempToZip = `${tempDir}/toZip`, zipFile = `${tempDir}/${Date.now()}.zip`, formData = new FormData()
    let toZip
    try {
      context.setLoad(true)
      await RNFS.mkdir(tempToZip)
      await cpmv(toUpload, tempToZip, true)
      toZip = await zip(tempToZip, zipFile)
      formData.append("file", { uri: `file://${toZip}`, name: zipFile.split("/")[1], type: "application/zip" })
      await fetch(destination === " " ? `${context.url}/upload` : `${context.url}/upload?dir=${encodeURI(destination)}`, { method: "POST", body: formData })
    } catch {
      showToast("Error al subir el archivo")
    } finally {
      context.setLoad(false)
      await RNFS.unlink(tempDir)
    }
  },
  /**
   * Descargará archivos o directorios a remoto
   * 
   * @param toDownload Lista de elementos que se quiere descargar del remoto
   * @param destination Directorio de destino
   * @param context Contexto de la aplicación
   */
  download = async (toDownload: ModifyElements[], destination: string, context: ContextType) => {
    const last = context.lastFtpDir, url = `${context.url}/download`, dest = makePathWithRoot(destination)
    try {
      context.setLoad(true)

      if (toDownload.length === 1 && toDownload[0].type === "file") {
        const file = toDownload[0].path, params = new URLSearchParams(last === " " ? { file: file } : { dir: last, file: file })
        await RNFS.downloadFile({ fromUrl: `${url}?${params.toString()}`, toFile: `${dest}/${await getFileName(dest, file)}` }).promise
      }
      else {
        const { data } = await axios.post(last === " " ? url : `${url}?dir=${encodeURI(last)}`, { data: toDownload })
        await RNFS.downloadFile({ fromUrl: `${url}/${data.id}`, toFile: `${dest}/${Date.now()}.zip` }).promise
      }

    } catch {
      showToast("Error al descargar el archivo")
    } finally {
      context.setLoad(false)
    }

  },

  /**
   * Copiará o moverá directorios de forma recursiva
   * 
   * @param origin Directorio de origen
   * @param destination Directorio de destino
   * @param cp Medirá si se copia o se mueve el archivo
   * @param name Nombre para el rename
   */
  copyDir = async (origin: string, destination: string, cp?: boolean, name?: string) => {
    const dirToSplit = origin.split("/")
    let nameDir = "", newDir, dir
    nameDir = await getFileName(destination, name ?? dirToSplit[dirToSplit.length - 1])
    dir = await RNFS.readDir(origin)
    newDir = `${destination}/${nameDir}`
    await RNFS.mkdir(newDir)

    for (const item of dir) {
      
      if (item.isDirectory()) await copyDir(item.path, newDir, cp)
      else {
        const name = item.path.split("/").pop()
        await RNFS.copyFile(item.path, `${newDir}/${name}`)
      }

    }

    if (!cp) await RNFS.unlink(origin)

  },

  /**
   * Servirá para mover o copiar archivos y directorios, también servirá para renombrar
   * 
   * @param toCopy Lista de elementos que se quieren mover o copiar
   * @param destination Directorio de destino
   * @param cp Medirá si se copia o se mueve el archivo
   * @param name Nombre para el rename
   */
  cpmv = async (toCopy: ModifyElements[], destination: string, cp?: boolean, name?: string) => {
    for (const item of toCopy) {
      console.log(item.path)
      const currentItem = makePathWithRoot(item.path)

      if (item.type === "dir") await copyDir(currentItem, destination, cp, name)
      else {
        const currentItemToSplit = currentItem.split("/"), fileName = await getFileName(destination, name ?? currentItemToSplit[currentItemToSplit.length - 1]),
          dest = `${destination}/${fileName}`
        if (cp) await RNFS.copyFile(currentItem, dest)
        else await RNFS.moveFile(currentItem, dest)
      }

    }
  },

  /**
 * Manejará el funcionamiento de los menú item copiar o mover
 * 
 * @param context Contexto de la aplicación
 * @param setVisible Función para ocultar o mostrar el menú
 * @param title Título del item en cuestión
 * @param setTitle Función para cambiar el título
 * @param cp Medirá si se copia o se mueve el archivo
 */
  cpmvPath = async (context: ContextType, setVisible: Function, title: string, setTitle: Function, cp?: boolean) => {
    const toCopy = context.modifyLocalFile, titleToShow = title.toLocaleLowerCase()

    if (toCopy.length < 1) return noElements(setVisible)

    if (title === "Copiar" || title === "Mover") {
      if (context.onCopy) return showToast("Acción no disponible")
      showToast(`Elija el directorio donde ${titleToShow}`)
      setTitle("Pegar")
      setVisible(false)
      context.setOnCopy(true)
      context.setDirSelected(!context.dirSelected)
    } else {
      try {
        context.setLoad(true)
        const lastDir = makePathWithRoot(context.lastLocalDir)
        await cpmv(toCopy, lastDir, cp)
        context.setRefresh(!context.refresh)
      } catch {
        showToast(`Error al ${title}`)
      } finally {
        context.setLoad(false)
        context.setModifyLocalFile([])
        setTitle(cp ? "Copiar" : "Mover")
        setVisible(false)
        context.setOnCopy(false)
      }
    }

  },

  /**
   * Creará una nueva carpeta
   * 
   * @param context Contexto de la aplicación
   * @param name Nombre de la nueva carpeta
   * @param setVisible Función para ocultar o mostrar el menú
  */
  makeDir = async (context: ContextType, name: string, setVisible: Function) => {
    try {
      let last;

      if (context.lastComponent === "local") {
        last = makePathWithRoot(context.lastLocalDir)
        await RNFS.mkdir(`${last}/${await getFileName(last, name)}`)
      } else {
        last = context.lastFtpDir
        await axios.post(`${context.url}/mkdir${last === " " ? "" : `?dir=${encodeURI(last)}`}`, { name: name })
      }

    } catch {
      showToast("Error al crear carpeta")
    } finally {
      setVisible(false)
      context.setRefresh(!context.refresh)
    }
  },

  /**
   * Renombra un directorio o archivo
   * 
   * @param toRename Elemento que se quiere renombrar
   * @param context Contexto de la aplicación
   * @param destination Directorio de destino
   * @param context Contexto de la aplicación
   * @param setVisible Función para ocultar o mostrar el menú
   */
  rename = async (toRename: ModifyElements[], name: string, destination: string, context: ContextType, setVisible: Function) => {
    try {
      await cpmv(toRename, destination, false, name)
    } catch {
      showToast("Error al renombrar")
    } finally {
      setVisible(false)
      context.setModifyLocalFile([])
      context.setRefresh(!context.refresh)
    }
  },

  /**
   * Elimina de forma recursiva directorios o archivos
   * 
   * @param toRemove Elementos que se quiere eliminar
   * @param context Contexto de la aplicación
   * @param origin Directorio de origen
   * @param context Contexto de la aplicación
   * @param setVisible Función para ocultar o mostrar el menú
   */
  remove = async (toRemove: ModifyElements[], origin: string, context: ContextType, setVisible: Function) => {
    try {
      context.setLoad(true)

      for (const item of toRemove) {

        if (origin === "local") await RNFS.unlink(makePathWithRoot(item.path))

        else await axios.delete(`${context.url}/${item.type === "dir" ? "dir" : "file"}?path=${encodeURI(context.lastFtpDir === " " ?
          item.path : `${context.lastFtpDir}/${item.path}`)}`)

        setVisible(false)
      }

    } catch {
      showToast("Error al borrar")
    } finally {
      context.setLoad(false)
      context.setRefresh(!context.refresh)

      if (origin === "local") context.setModifyLocalFile([])

      if (origin === "ftp") context.setModifyFtpFile([])

    }
  },

  // devuelve la ruta dle icono segun su formato
  icons: any = {
    dir: require("../../assets/images/folder.png"), file: require("../../assets/images/file.png"), image: require("../../assets/images/image.png"),
    video: require("../../assets/images/video.png"), audio: require("../../assets/images/audio.png"), compress: require("../../assets/images/compress.png"),
    pdf: require("../../assets/images/pdf.png"), word: require("../../assets/images/word.png"), excel: require("../../assets/images/excel.png"),
    power: require("../../assets/images/power.png"), apk: require("../../assets/images/apk.png"), exe: require("../../assets/images/exe.png"),
    code: require("../../assets/images/code.png")
  },

  // devuelve un diccionario de extensiones según el tipo
  extensionLibrary = (type: string) => {
    if (type === "executable") return ["exe", "bat", "sh"]

    if (type === "code") {
      return [
        "js", "ts", "jsx", "tsx", "java", "kt", "kts", "cs", "py", "c", "cpp", "h", "hpp",
        "php", "rb", "go", "rs", "swift", "html", "css", "scss", "json", "xml", "sh", "bat"
      ]
    }

    return [];
  },

  // devuelve el tipo de un archivo 
  getTypeFile = (file: string) => {
    const type = mime.getType(file)

    switch (true) {

      case type?.startsWith("image"): return "image"

      case type?.startsWith("video"): return "video"

      case type?.startsWith("audio"): return "audio"

      case type?.includes("zip") || type?.includes("compressed"): return "compress"

      case type?.includes("pdf"): return "pdf"

      case type?.includes("word"): return "word"

      case type?.includes("excel") || type?.includes("spreadsheet"): return "excel"

      case type?.includes("presentation") || type?.includes("powerpoint"): return "power"

      default: {
        const ext = file.split(".").pop()?.toLowerCase() ?? ""
        if (ext === "apk") return "apk"

        if (extensionLibrary("executable").includes(ext)) return "exe"

        if (extensionLibrary("code").includes(ext)) return "code"

        return "file"
      }
    }
  },

  /**
   * Se encargará de manejar cualquier intent sobre un archivo
   * 
   * @param origin Ruta origen
   * @param name Nombre del archivo
   * @param context Contexto de la aplicación
   */
  openFile = async (origin: string, name: string, context: ContextType) => {
    const typeFile = getTypeFile(name), originWithRoot = makePathWithRoot(origin), file = `${originWithRoot}/${name}`
    if (typeFile === "compress") {
      Alert.alert("", "Se va a descomprimir el archivo", [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Ok",
          onPress: async () => {
            const nameZipDir = name.substring(0, name.lastIndexOf(".")), zipDir = `${originWithRoot}/${nameZipDir}`
            try {
              context.setLoad(true)
              await unzip(file, zipDir)
              const list = await RNFS.readDir(zipDir)
              await cpmv(list.map(item => ({ path: `${origin}/${nameZipDir}/${item.name}`, type: item.isDirectory() ? "dir" : "file" })), originWithRoot)
            } catch {
              showToast("Error al descomprimir")
            } finally {
              await RNFS.unlink(zipDir)
              await RNFS.unlink(file)
              context.setLoad(false)
              context.setRefresh(!context.refresh)
            }
          }
        }
      ])

    } else {
      try {
        await FileOpener.openFile(file)
      } catch {
        showToast(`Error al abrir el archivo ${name}`)
      } finally {
        context.setLastLocalDir(" ")
        context.setRefresh(!context.refresh)
      }
    }
  }
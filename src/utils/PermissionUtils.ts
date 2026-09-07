import { NativeModules } from "react-native"

const { StoragePermission } = NativeModules

export const
// pide acceso completo al sistema de archivos
 ensureStoragePermission = async () => {
  const granted = await StoragePermission.isExternalStorageManager()

  if (granted) return true

  StoragePermission.openAllFilesAccess()
  return false
}
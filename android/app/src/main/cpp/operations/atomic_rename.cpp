#include <jni.h>
#include <cerrno>
#include <fcntl.h>
#include <linux/fs.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <string>

extern "C" JNIEXPORT jint JNICALL
Java_com_hhrcore_fileexplorer_operation_AtomicRename_renameBytes(JNIEnv *env, jobject, jbyteArray source, jbyteArray destination) {
    std::string from(env->GetArrayLength(source), '\0');
    std::string to(env->GetArrayLength(destination), '\0');
    env->GetByteArrayRegion(source, 0, from.size(), reinterpret_cast<jbyte *>(&from[0]));
    env->GetByteArrayRegion(destination, 0, to.size(), reinterpret_cast<jbyte *>(&to[0]));
    if (env->ExceptionCheck()) return ENOMEM;
    int result = syscall(SYS_renameat2, AT_FDCWD, from.c_str(), AT_FDCWD, to.c_str(), RENAME_NOREPLACE);
    int error = result == 0 ? 0 : errno;
    return error;
}

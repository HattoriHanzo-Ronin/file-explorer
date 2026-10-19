cmake_minimum_required(VERSION 3.22.1)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
add_library(file_operations SHARED operations/atomic_rename.cpp)

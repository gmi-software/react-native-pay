#include <jni.h>
#include "NitroPayOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::pay::initialize(vm);
}

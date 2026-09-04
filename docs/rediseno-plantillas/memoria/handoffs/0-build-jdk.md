# 0-build-jdk — cómo hacer compilar el backend en este entorno (verificado por el orquestador raíz)

- Problema: `build.gradle.kts` fija toolchain Java 17 (`java { toolchain { languageVersion = 17 } }`, líneas ~19-22) y `jvmTarget = "17"` (líneas ~118-124). Solo hay JDK 21 instalado.
- Probado y **fallido**: plugin `org.gradle.toolchains.foojay-resolver-convention` 0.9.0 en `settings.gradle.kts` → el proxy devuelve 403 al descargar el JDK.
- Probado y **exitoso**: en una copia aislada, `JavaLanguageVersion.of(21)` + `jvmTarget = "21"` (ambos `compileKotlin` y `compileTestKotlin`) → `./gradlew compileKotlin` termina con EXIT 0 sin errores de compilación. Maven Central sí resuelve a través del proxy.
- Instrucción para la fase 2: aplicar exactamente ese cambio mínimo (4 líneas) en `build.gradle.kts`, registrarlo como ADR ("toolchain 21; Spring Boot 3.4 y Kotlin 1.9.25 lo soportan") y dejar `gradlew` ejecutable (`git update-index --chmod=+x gradlew` si aplica). Nada más se toca del build salvo dependencias de test y del módulo nuevo.

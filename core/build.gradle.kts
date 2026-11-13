plugins { kotlin("multiplatform") }
repositories { mavenCentral() }
kotlin {
    jvm { }
    // 試験用: JVM で実行 (gradle :core:crossCheckJvm)
    js(IR) {
        browser()
        nodejs()
        useEsModules()
        binaries.library()
    }
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs { browser() }
    sourceSets.all { languageSettings.optIn("kotlin.ExperimentalStdlibApi") }
}

tasks.register<JavaExec>("crossCheckJvm") {
    group = "verification"
    val jvmJar = tasks.named("jvmJar")
    dependsOn(jvmJar)
    classpath(jvmJar, configurations.named("jvmRuntimeClasspath"))
    mainClass.set("MainKt")
    args(providers.gradleProperty("mode").orElse(providers.gradleProperty("cpuMoves")).orElse("0").get())
}

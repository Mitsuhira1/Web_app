import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
plugins {
    kotlin("multiplatform")
    id("org.jetbrains.compose")
    id("org.jetbrains.kotlin.plugin.compose")
}
repositories { mavenCentral(); google() }
kotlin {
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        moduleName = "asobi"
        browser { commonWebpackConfig { outputFileName = "asobi.js" } }
        binaries.executable()
    }
    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(project(":core"))
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
                implementation(compose.components.resources)
            }
        }
    }
}

compose.resources {
    packageOfResClass = "jp.yonekou.asobi26.res"
    publicResClass = true
}

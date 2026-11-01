plugins {
    id("com.android.application")
}

android {
    namespace = "com.phoenixsekur.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.phoenixsekur.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-essai"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

configurations.configureEach {
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk7")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk8")
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.browser:browser:1.8.0")
}

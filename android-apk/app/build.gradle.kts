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
        versionCode = 2
        versionName = "0.1.1-essai"
    }

    signingConfigs {
        create("essai") {
            storeFile = file("phoenix-essai.jks")
            storePassword = "phoenix-essai"
            keyAlias = "phoenix"
            keyPassword = "phoenix-essai"
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("essai")
        }
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.getByName("essai")
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

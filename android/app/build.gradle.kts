plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android { namespace = "com.mybusiness.app"; compileSdk = 35
    defaultConfig { applicationId = "com.mybusiness.app"; minSdk = 24; targetSdk = 35; versionCode = 1; versionName = "1.0.0" }
    buildTypes { release { isMinifyEnabled = false; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("dev.ffmpegkit-maintained:llama-android:0.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

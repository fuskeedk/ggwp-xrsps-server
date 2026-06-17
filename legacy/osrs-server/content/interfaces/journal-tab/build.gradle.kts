plugins {
    id("base-conventions")
}

dependencies {
    implementation(libs.kotlin.coroutines.core)
    implementation(projects.api.account)
    implementation(projects.api.db)
    implementation(projects.api.pluginCommons)
}

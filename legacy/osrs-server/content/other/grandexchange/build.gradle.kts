plugins {
    id("base-conventions")
}

dependencies {
    implementation(projects.api.pluginCommons)
    implementation(projects.api.market)
    implementation(projects.api.invtx)
    implementation("com.google.code.gson:gson:2.13.2")
}

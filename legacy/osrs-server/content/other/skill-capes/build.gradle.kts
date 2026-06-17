plugins {
    id("base-conventions")
}

dependencies {
    implementation(projects.api.invtx)
    implementation(projects.api.pluginCommons)
    implementation(projects.api.playerOutput)
    implementation(projects.api.script)
}

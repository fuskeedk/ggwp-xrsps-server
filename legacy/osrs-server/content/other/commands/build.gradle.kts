plugins {
    id("base-conventions")
}

dependencies {
    implementation(libs.fastutil)
    implementation(libs.simmetrics.core)
    implementation(libs.kotlin.coroutines.core)
    implementation(projects.api.db)
    implementation(projects.api.dbGateway)
    implementation(projects.api.invtx)
    implementation(projects.api.mechanics.toxins)
    implementation(projects.api.pluginCommons)
    implementation(projects.api.playerOutput)
    implementation(projects.api.registry)
    implementation(projects.api.serverConfig)
    implementation(projects.content.other.login)
    implementation(projects.orCache)
    implementation(projects.server.services)

    implementation(projects.api.utils.utilsSystem)
    implementation(projects.engine.utilsBits)
}

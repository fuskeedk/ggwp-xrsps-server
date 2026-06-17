plugins {
    id("base-conventions")
}

dependencies {
    implementation(projects.api.combat.combatManager)
    implementation(projects.api.market)
    implementation(projects.api.pluginCommons)
    implementation(projects.api.spells)
}

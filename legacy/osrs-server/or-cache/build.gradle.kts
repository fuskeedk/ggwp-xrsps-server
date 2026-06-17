plugins {
    id("base-conventions")
}

dependencies {
    // Source: https://mvnrepository.com/artifact/com.google.code.gson/gson
    implementation("com.google.code.gson:gson:2.13.2")
    implementation(libs.kotlin.coroutines.core)

    implementation(rootProject.libs.or2.all.cache)
    implementation(rootProject.project.libs.or2.tools)
    implementation(rootProject.project.libs.or2.server.utils)
    api(libs.or2.definition)
    api(libs.or2.filestore)
    api(libs.or2.filesystem)
    implementation(projects.engine.map)
    implementation(projects.engine.routefinder)
    implementation("com.michael-bull.kotlin-inline-logger:kotlin-inline-logger:1.0.6")
    implementation("com.squareup:kotlinpoet:2.2.0")
    implementation("me.tongfei:progressbar:0.9.2")
    implementation(libs.netty.buffer)
    implementation(libs.jackson.dataformat.toml)
    implementation(libs.jackson.databind)
    implementation("dev.or2:toml-rsconfig:1.0")
    implementation(libs.fastutil)
}

tasks {
    register("buildCache",JavaExec::class) {
        group = "cache"
        description = "Build Cache"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.CacheToolsKt")
        args = listOf("BUILD")
    }

    register("freshCache",JavaExec::class) {
        group = "cache"
        description = "Fresh Install Cache"

        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.CacheToolsKt")
        args = listOf("FRESH_INSTALL")
    }

    register<JavaExec>("dumpGeTiles") {
        group = "cache"
        description = "Check GE tile walkability for NPC placement"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpGeTilesKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpNpcNames") {
        group = "cache"
        description = "Resolve npc id to RSCM key"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpNpcNamesKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpFishSpots") {
        group = "cache"
        description = "Dump fishing spot NPC ops from cache"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpFishSpotsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpCraftLocs") {
        group = "cache"
        description = "Dump crafting-related locs from cache"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpCraftLocsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpNpcById") {
        group = "cache"
        description = "Reverse-map NPC ids to internal names"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpNpcByIdKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpNpcByName") {
        group = "cache"
        description = "Find NPCs by display name or key substring"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpNpcByNameKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpNpcOps") {
        group = "cache"
        description = "Dump NPC op slots by internal name"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpNpcOpsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpLocOps") {
        group = "cache"
        description = "Dump locs matching op text"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpLocOpsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpFarmingPatches") {
        group = "cache"
        description = "Dump farming patch locs from cache"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpFarmingPatchesKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpLocNames") {
        group = "cache"
        description = "Dump loc internal names matching filter args"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpLocNamesKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpSeqNames") {
        group = "cache"
        description = "Dump sequence names containing fish"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpSeqNamesKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpObjOps") {
        group = "cache"
        description = "Dump inventory/ground ops for an obj"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpObjOpsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpQuestDbrows") {
        group = "cache"
        description = "List quest dbrow keys from cache"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpQuestDbrowsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpVarpById") {
        group = "cache"
        description = "Reverse-map varp ids to names"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpVarpByIdKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpAllVarps") {
        group = "cache"
        description = "List all varps (optional name filter args)"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpAllVarpsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpVarps") {
        group = "cache"
        description = "List varps matching name filter"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpVarpsKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("dumpMapSquare") {
        group = "cache"
        description = "Dump map square terrain/loc/npc sizes and NPC spawns"
        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.tools.DumpMapSquareKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

    register<JavaExec>("mergePluginGamevals") {
        group = "cache"
        description =
            "Writes plugin gamevals.toml entries into .data/gamevals/*.rscm (used by release CI)"

        classpath = sourceSets["main"].runtimeClasspath
        mainClass.set("dev.openrune.gamevals.PluginGamevalMergerKt")
        workingDir = rootProject.projectDir
        dependsOn("classes")
    }

}

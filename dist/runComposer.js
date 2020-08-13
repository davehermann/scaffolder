"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunComposer = void 0;
// Node Modules
const fs_1 = require("fs");
const path = require("path");
// NPM Modules
const fs_utilities_1 = require("@davehermann/fs-utilities");
const process_spawner_1 = require("@davehermann/process-spawner");
const multi_level_logger_1 = require("multi-level-logger");
const findComposers_1 = require("./findComposers");
const selectComposerToRun_1 = require("./selectComposerToRun");
const RUNTIME_CONFIGURATION = {
    installDependencies: (process.env.NO_NPM === undefined ? true : (process.env.NO_NPM !== `true`)),
    addToGit: (process.env.NO_GIT === undefined ? true : (process.env.NO_GIT !== `true`)),
};
async function handleChildProcess(commands, { answers, configuration }) {
    const spawnedProcess = await process_spawner_1.SpawnProcess(commands, { cwd: configuration.installDestination }, { consolePassthrough: true });
    const data = new Promise((resolve, reject) => {
        let content = ``, errText = ``;
        spawnedProcess.stdin.setEncoding(`utf8`);
        spawnedProcess.stdout.on(`data`, d => {
            // eslint-disable-next-line no-console
            console.log(d.toString());
            content += d;
        });
        spawnedProcess.stderr.on(`data`, d => {
            // eslint-disable-next-line no-console
            console.log(d.toString());
            errText += d;
        });
        spawnedProcess.on(`close`, () => {
            // Ignore some errors
            const ignoreError = !!errText && (errText.search(/^npm [notice|WARN]/) == 0);
            if (!!errText && !ignoreError) {
                reject(errText);
            }
            else
                resolve(content);
        });
    });
    return data;
}
async function dependencyInstallation(composer, { answers, configuration }) {
    if (RUNTIME_CONFIGURATION.installDependencies) {
        const { runtime, development } = composer.InstallDependencies({ answers, configuration });
        if (!!runtime || !!development)
            multi_level_logger_1.Log(`Installing Dependencies`, { configuration: { includeCodeLocation: false } });
        else
            multi_level_logger_1.Log(`No dependencies required`, { configuration: { includeCodeLocation: false } });
        if (!!runtime)
            await handleChildProcess([`npm`, `install`, ...runtime], { answers, configuration });
        if (!!development)
            await handleChildProcess([`npm`, `install`, `--save-dev`, ...development], { answers, configuration });
    }
    else
        multi_level_logger_1.Log(`Skipping Dependency Installation`, { configuration: { includeCodeLocation: false } });
}
async function writeFiles(templateFiles, { configuration }) {
    for (const [relativeFilePath, contents] of templateFiles.entries()) {
        const filePath = path.join(configuration.installDestination, relativeFilePath);
        await fs_utilities_1.EnsurePathForFile(filePath);
        multi_level_logger_1.Log(`Adding ${relativeFilePath}`, { configuration: { includeCodeLocation: false } });
        await fs_1.promises.writeFile(filePath, contents, { encoding: `utf8` });
    }
}
async function runAnySuccessiveComposers(composer, { answers, configuration }) {
    const additionalComposers = composer.composer.AdditionalCompositions({ answers, configuration });
    if (additionalComposers.length > 0) {
        for (const { composerName, data } of additionalComposers) {
            multi_level_logger_1.Log(`Running additional composer for ${composer.name} (${additionalComposers.length} remaining)`, { configuration: { includeCodeLocation: false } });
            const peerComposer = await findComposers_1.LoadNamedComposer(selectComposerToRun_1.GetComposerRoot(composer.path), composerName);
            if (!peerComposer)
                throw `No composer named "${composerName}" was found as a peer of "${composer.name}" composer (${composer.path})`;
            // Copy answers and configuration
            const answerCopy = JSON.parse(JSON.stringify(answers)), configurationCopy = JSON.parse(JSON.stringify(configuration));
            // Replace any answers prop with the prop from data
            if (!!(data === null || data === void 0 ? void 0 : data.answers))
                for (const prop in data.answers)
                    answerCopy[prop] = data.answers[prop];
            if (!!(data === null || data === void 0 ? void 0 : data.configuration))
                for (const prop in data.configuration)
                    configurationCopy[prop] = data.configuration[prop];
            await scaffolder(peerComposer, { answers: answerCopy, configuration: configurationCopy });
        }
    }
}
async function scaffolder(composer, { answers, configuration } = { answers: null, configuration: null }) {
    multi_level_logger_1.Log(`Using "${composer.name}" composer`, { configuration: { includeCodeLocation: false } });
    // Prompt for questions
    if (!answers)
        answers = {};
    if (!answers[composer.name]) {
        // Only prompt if a section for this composer hasn't been passed in
        const composerAnswers = await composer.composer.AskQuestions({ answers: null });
        answers[composer.name] = composerAnswers;
    }
    multi_level_logger_1.Debug({ answers });
    // Create a configuration
    if (!configuration)
        configuration = {};
    composer.composer.SetConfiguration({ answers, configuration });
    multi_level_logger_1.Debug({ configuration });
    // Skip template processing/writing, dependency installation, and git commit if this is a passthrough composer
    if (!composer.composer.passthroughOnly) {
        // Get composer templates
        const composerTemplates = await composer.composer.GetTemplateFiles({ answers, configuration });
        for (const [path, contents] of composerTemplates.entries())
            multi_level_logger_1.Debug({ path, contents });
        // Write files
        await writeFiles(composerTemplates, { configuration });
        // Install dependencies
        await dependencyInstallation(composer.composer, { answers, configuration });
    }
    // Run any additional composers
    await runAnySuccessiveComposers(composer, { answers, configuration });
    // Commit to Git source control
    if (!!composer.composer.automaticCommitMessage && RUNTIME_CONFIGURATION.addToGit && !composer.composer.passthroughOnly) {
        await handleChildProcess([`git`, `init`], { answers, configuration });
        await handleChildProcess([`git`, `add`, `.`], { answers, configuration });
        await handleChildProcess([`git`, `commit`, `-m`, `"${composer.composer.automaticCommitMessage}"`], { answers, configuration });
    }
}
exports.RunComposer = scaffolder;

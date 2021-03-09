// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { EnsurePathForFile } from "@davehermann/fs-utilities";
import { SpawnProcess } from "@davehermann/process-spawner";
import { Debug, Log, Dev } from "multi-level-logger";

// Application Modules
import { IOptions, IRegisteredComposer } from "./interfaces";
import { RootComposer } from "./rootComposer";
import { LoadNamedComposer } from "./findComposers";
import { GetComposerRoot } from "./selectComposerToRun";

const RUNTIME_CONFIGURATION = {
    installDependencies: (process.env.NO_NPM === undefined ? true : (process.env.NO_NPM !== `true`)),
    addToGit: (process.env.NO_GIT === undefined ? true : (process.env.NO_GIT !== `true`)),
};

async function handleChildProcess(commands: string | Array<string>, { answers, configuration }: IOptions): Promise<string> {
    const spawnedProcess = await SpawnProcess(commands, { cwd: configuration.installDestination }, { consolePassthrough: true });

    const data: Promise<string> = new Promise((resolve, reject) => {
        let content = ``,
            errText = ``;

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
            const ignoreError: boolean = !!errText && (errText.search(/^npm [notice|WARN]/) == 0);
            if (!!errText && !ignoreError) {
                reject(errText);
            } else
                resolve(content);
        });
    });

    return data;
}

async function dependencyInstallation(composer: RootComposer, { answers, configuration }: IOptions): Promise<void> {
    if (RUNTIME_CONFIGURATION.installDependencies) {
        const { runtime, development } = composer.InstallDependencies({ answers, configuration });

        if (!!runtime || !!development)
            Log(`Installing Dependencies`, { configuration: { includeCodeLocation: false } });
        else
            Log(`No dependencies required`, { configuration: { includeCodeLocation: false } });

        if (!!runtime)
            await handleChildProcess([`npm`, `install`, ...runtime], { answers, configuration });

        if (!!development)
            await handleChildProcess([`npm`, `install`, `--save-dev`, ...development], { answers, configuration });
    } else
        Log(`Skipping Dependency Installation`, { configuration: { includeCodeLocation: false } });
}

async function writeFiles(composer: RootComposer, templateFiles: Map<string, string>, { configuration }: IOptions): Promise<void> {
    for (const [relativeFilePath, contents] of templateFiles.entries()) {
        const filePath = path.join(configuration.installDestination, relativeFilePath);

        await EnsurePathForFile(filePath);
        Log(`Adding ${relativeFilePath}`, { configuration: { includeCodeLocation: false } });

        // Check the file type
        const isBinaryFile = composer.isBinaryFile(filePath);
        // Handle as RootComposer handles file reads: from base64
        await fs.writeFile(filePath, contents, { encoding: isBinaryFile ? `base64` : `utf8` });
    }
}

async function postInstallTasks(composer: IRegisteredComposer, { answers, configuration }: IOptions): Promise<void> {
    const taskList = composer.composer.PostInstallTasks({ answers, configuration });

    if (taskList.length > 0)
        Log(`Running post-dependency-install tasks: ${taskList.length} total`, { configuration: { includeCodeLocation: false } });

    while (taskList.length > 0) {
        const nextTask = taskList.shift();

        Log(nextTask.cliCommand, { configuration: { includeCodeLocation: false } });

        if (!nextTask.requiresDependencies || RUNTIME_CONFIGURATION.installDependencies)
            await handleChildProcess(nextTask.cliCommand, { answers, configuration });
    }
}

async function runAnySuccessiveComposers(composer: IRegisteredComposer, { answers, configuration }: IOptions): Promise<void> {
    const additionalComposers = composer.composer.AdditionalCompositions({ answers, configuration });

    if (additionalComposers.length > 0) {
        for (const { composerName, data } of additionalComposers) {
            Log(`Running additional composer for ${composer.name} (${additionalComposers.length} remaining)`, { configuration: { includeCodeLocation: false } });

            const peerComposer = await LoadNamedComposer(GetComposerRoot(composer.path), composerName);

            if (!peerComposer)
                throw `No composer named "${composerName}" was found as a peer of "${composer.name}" composer (${composer.path})`;

            // Copy answers and configuration
            const answerCopy = JSON.parse(JSON.stringify(answers)),
                configurationCopy = JSON.parse(JSON.stringify(configuration));

            // Replace any answers prop with the prop from data
            if (!!data?.answers)
                for (const prop in data.answers)
                    answerCopy[prop] = data.answers[prop];

            if (!!data?.configuration)
                for (const prop in data.configuration)
                    configurationCopy[prop] = data.configuration[prop];

            Dev({ answerCopy, configurationCopy });

            // Specify as a sub-composer
            peerComposer._isSubComposer = true;

            await scaffolder(peerComposer, { answers: answerCopy, configuration: configurationCopy });

            if (peerComposer.composer.persistConfiguration) {
                // Update the answers and configuration following the composer operation
                for (const prop in answerCopy)
                    answers[prop] = answerCopy[prop];

                for (const prop in configurationCopy)
                    configuration[prop] = configurationCopy[prop];
            }
        }
    }
}

async function scaffolder(composer: IRegisteredComposer, { answers, configuration }: IOptions = { answers: null, configuration: null }, rootComposerName: string = null): Promise<void> {
    Log(`Using "${composer.name}" composer`, { configuration: { includeCodeLocation: false } });

    // Prompt for questions
    if (!answers)
        answers = {};
    if (!answers[composer.name]) {
        // Only prompt if a section for this composer hasn't been passed in
        const composerAnswers = await composer.composer.AskQuestions({ answers: null });
        answers[composer.name] = composerAnswers;
    }
    Debug({ answers });

    // Create a configuration
    if (!configuration)
        configuration = {};
    composer.composer.SetConfiguration({ answers, configuration });
    Debug({ configuration });

    // Skip template processing/writing, dependency installation, and git commit if this is a passthrough composer
    if (!composer.composer.passthroughOnly) {
        // Get composer templates
        const composerTemplates: Map<string, string> = await composer.composer.GetTemplateFiles({ answers, configuration });
        for (const [path, contents] of composerTemplates.entries())
            Debug({ path, contents });

        // Write files
        await writeFiles(composer.composer, composerTemplates, { configuration });

        // Install dependencies
        await dependencyInstallation(composer.composer, { answers, configuration });

        // Run any post-install tasks for the composer
        await postInstallTasks(composer, { answers, configuration });
    }

    // Run any additional composers
    await runAnySuccessiveComposers(composer, { answers, configuration });

    // Save the configuration of the top-level composer
    let writingConfiguration = false;
    if (!composer._isSubComposer) {
        writingConfiguration = true;
        await fs.writeFile(path.join(configuration.installDestination, `.scaffolderrc.json`), JSON.stringify({ composer: rootComposerName, configuration, answers }, null, 4), { encoding: `utf8` });
        Log(`".scaffolderrc.json" has NOT been committed. Check for passwords or other sensitive data before committing.`, { configuration: { includeCodeLocation: false } });
    }

    // Commit to Git source control
    if (!!composer.composer.automaticCommitMessage && RUNTIME_CONFIGURATION.addToGit && !composer.composer.passthroughOnly) {
        await handleChildProcess([`git`, `init`, `--initial-branch=main`], { answers, configuration });
        await handleChildProcess([`git`, `add`, `.`], { answers, configuration });
        if (writingConfiguration)
            await handleChildProcess([`git`, `rm`, `--cached`, `.scaffolderrc.json`], { answers, configuration });
        await handleChildProcess([`git`, `commit`, `-m`, `"${composer.composer.automaticCommitMessage}"`], { answers, configuration });
    }
}

export {
    scaffolder as RunComposer,
};

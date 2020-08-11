// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { EnsurePathForFile } from "@davehermann/fs-utilities";
import { SpawnProcess } from "@davehermann/process-spawner";
import { Debug, Log } from "multi-level-logger";

// Application Modules
import { IOptions, IRegisteredComposer } from "./interfaces";
import { RootComposer } from "./rootComposer";
import { LoadNamedComposer } from "./findComposers";
import { GetComposerRoot } from "./selectComposerToRun";

const RUNTIME_CONFIGURATION = {
    installDependencies: (process.env.NO_NPM === undefined ? true : (process.env.NO_NPM !== `true`)),
    addToGit: (process.env.NO_GIT === undefined ? true : (process.env.NO_GIT !== `true`)),
};

async function handleChildProcess(commands: Array<string>, { answers, configuration }: IOptions): Promise<string> {
    const spawnedProcess = await SpawnProcess(commands, { cwd: configuration.rootDirectory }, { consolePassthrough: true });

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
            Log(`No dependencies required`);

        if (!!runtime)
            await handleChildProcess([`npm`, `install`, ...runtime], { answers, configuration });

        if (!!development)
            await handleChildProcess([`npm`, `install`, `--save-dev`, ...development], { answers, configuration });
    } else
        Log(`Skipping Dependency Installation`, { configuration: { includeCodeLocation: false } });
}

async function writeFiles(templateFiles: Map<string, string>, { configuration }: IOptions): Promise<void> {
    for (const [relativeFilePath, contents] of templateFiles.entries()) {
        const filePath = path.join(configuration.rootDirectory, relativeFilePath);

        await EnsurePathForFile(filePath);
        Log(`Adding ${relativeFilePath}`, { configuration: { includeCodeLocation: false } });
        await fs.writeFile(filePath, contents, { encoding: `utf8` });
    }
}

async function runAnySuccessiveComposers(composer: IRegisteredComposer, { answers, configuration }: IOptions): Promise<void> {
    const additionalComposers = composer.composer.AdditionalCompositions({ answers, configuration });

    if (additionalComposers.length > 0) {
        Log(`Running additional composers (${additionalComposers.length} found)`);

        for (const { composerName, data } of additionalComposers) {
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

            await scaffolder(peerComposer, { answers: answerCopy, configuration: configurationCopy });
        }
    }
}

async function scaffolder(composer: IRegisteredComposer, { answers, configuration }: IOptions = { answers: null, configuration: null }): Promise<void> {
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

    // Get composer templates
    const composerTemplates: Map<string, string> = await composer.composer.GetTemplateFiles({ answers, configuration });
    await composer.composer.FileChanges(composerTemplates, { answers, configuration });
    for (const [path, contents] of composerTemplates.entries())
        Debug({ path, contents });

    // Write files
    await writeFiles(composerTemplates, { configuration });

    // Install dependencies
    await dependencyInstallation(composer.composer, { answers, configuration });

    // Run any additional composers
    await runAnySuccessiveComposers(composer, { answers, configuration });

    // Commit to Git source control
    if (!!composer.composer.automaticCommitMessage && RUNTIME_CONFIGURATION.addToGit) {
        await handleChildProcess([`git`, `init`], { answers, configuration });
        await handleChildProcess([`git`, `add`, `.`], { answers, configuration });
        await handleChildProcess([`git`, `commit`, `-m`, `"${composer.composer.automaticCommitMessage}"`], { answers, configuration });
    }
}

export {
    scaffolder as RunComposer,
};

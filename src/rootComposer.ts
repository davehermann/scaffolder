// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { IDirectoryObject, ReadSubDirectories } from "@davehermann/fs-utilities";
import * as inquirer from "inquirer";
import { Dev } from "multi-level-logger";
import textExtensions from "textextensions";
import binaryExtensions from "binaryextensions";

// Application Modules
import { IDependencyList, IAdditionalComposition, IOptions, IPostInstallTask } from "./interfaces";

abstract class RootComposer {
    /**
     * @param composerDirectory - Pass in **__dirname** from the composer
     */
    constructor(readonly subclassDirectory: string) {
        if (!subclassDirectory) throw new Error(`RootComposer requires subclasses to call super(__dirname) in their constructor`);
        this.enabled = true;
    }

    /** Is this composer enabled */
    public enabled: boolean;

    /** Commit message when this completes (Leave as **undefined** for no Git commit) */
    public automaticCommitMessage: string;

    /** This composer configures other composers, and does not compose templates */
    public passthroughOnly = false;

    /** Configuration should be persisted to disk when writing initial configuration */
    public persistConfiguration = false;

    /** Override to provide questions for the child composer */
    public Questions({ answers }: IOptions): inquirer.QuestionCollection {
        return [];
    }

    /** Display any questions for this composer to the user */
    public async AskQuestions({ answers }: IOptions): Promise<inquirer.Answers> {
        const questions = this.Questions({ answers });

        const promptAnswers = await inquirer.prompt(questions);
        return promptAnswers;
    }

    /**
     * Override to provide configuration settings
     *   - Set **configuration.installDestination** in your main composer to your newly created path
     */
    public SetConfiguration({ answers, configuration }: IOptions): void {
        if (!configuration.installDestination  && !this.passthroughOnly)
            throw `configuration.installDestination must be specified in a SetConfiguration() override in your composer`;
    }

    /** Override to inject directory structure or file renaming into the path */
    public InstallPath(filePath: string, { answers, configuration }: IOptions): string {
        return filePath;
    }

    protected async AddFileOnDiskToTemplates(filePath: string, existingTemplates: Map<string, string>, { configuration }: IOptions): Promise<void> {
        // Load the file into the templates
        if (!existingTemplates.has(filePath)) {
            // Read the existing file
            const contents = await fs.readFile(path.join(configuration.installDestination, filePath), { encoding: `utf8` });
            existingTemplates.set(filePath, contents);
        }
    }

    private getPathToTemplate(existingTemplates: Map<string, string>, filePath: string, { answers, configuration }: IOptions): string {
        if (existingTemplates.has(filePath))
            return filePath;

        // Pass through InstallPath if the file path isn't found
        const installPath = this.InstallPath(filePath, { answers, configuration });
        if (existingTemplates.has(installPath))
            return installPath;

        throw new Error(`No template for "${filePath}" or "${installPath}" found`);
    }

    /**
     * Utility to drop templates
     * @param filesToRemove - file names will be automatically passed through **InstallPath** if not directly in template map
     */
    protected RemoveFromTemplates(filesToRemove: string | Array<string>, existingTemplates: Map<string, string>, { answers, configuration }: IOptions): void {
        if (typeof filesToRemove == `string`)
            filesToRemove = [filesToRemove];

        filesToRemove.forEach(filePath => {
            existingTemplates.delete(this.getPathToTemplate(existingTemplates, filePath, { answers, configuration }));
        });
    }

    private getDirectoryFiles(directoryRoot: IDirectoryObject, foundFiles: Array<string> = []): Array<string> {
        while (directoryRoot.items.length > 0) {
            const nextItem = directoryRoot.items.shift();

            if (nextItem.isDirectory)
                this.getDirectoryFiles(nextItem, foundFiles);
            else
                foundFiles.push(nextItem.objectPath);
        }

        return foundFiles;
    }

    private replaceTemplateTokens(fileContents: string, { answers, configuration }: IOptions): string {
        const replacements = fileContents.match(/\$\$\$(\w+\.?)+(\/(\w+(:[@\w]+)*[,;]?)+)*\$\$\$/g);

        if (!!replacements)
            replacements.forEach(fullId => {
                const replacementId = fullId.substr(3, fullId.length - 6);
                const [source, ...directives] = replacementId.split(`/`);
                const [root, ...props] = source.split(`.`);
                Dev({ fullId, source, directives, root, props });

                let value: any;
                // Non-standard roots must be implemented in each composer
                switch (root) {
                    case `answers`:
                        value = answers;
                        break;

                    case `configuration`:
                        value = configuration;
                        break;
                }
                while ((props.length > 0) && !!value)
                    value = value[props.shift()];
                Dev({ value });

                directives.forEach(directive => {
                    const [action, data] = directive.split(`:`);

                    switch (action) {
                        case `default`:
                            if (!value)
                                value = data;
                            break;

                        case `lowercase`:
                            if (!!value)
                                value = value.toLowerCase();
                            break;

                        case `replace`:
                            if (!!value) {
                                const [original, update] = data.split(`;`);
                                value = value.replace(original, update);
                            }
                            break;

                        case `substr`:
                            if (!!value)
                                value = value.substr(+data);
                            break;
                    }
                });

                if (value !== undefined)
                    fileContents = fileContents.replace(fullId, value);
            });

        return fileContents;
    }

    protected ReplaceToken(existingTemplates: Map<string, string>, templatePath: string, token: string, replacement: string, { answers, configuration }: IOptions): void {
        const pathInTemplate = this.getPathToTemplate(existingTemplates, templatePath, { answers, configuration });
        const loadedFileContents = existingTemplates.get(pathInTemplate);
        const replacementId = new RegExp(`\\$\\$\\$${token}\\$\\$\\$`);
        const updatedFileContents = loadedFileContents.replace(replacementId, replacement);
        existingTemplates.set(pathInTemplate, updatedFileContents);
    }

    public isBinaryFile(filePath: string): boolean {
        const extension = path.extname(filePath);

        // A dot file (e.g. .gitignore) or no extension will have no length
        // Assume as text file
        if (extension.length == 0)
            return false;

        if (binaryExtensions.indexOf(extension.substr(1)) >= 0)
            return true;

        if (textExtensions.indexOf(extension.substr(1)) >= 0)
            return false;

        // Default to null for anything that can't be determined
        return null;
    }

    public async GetTemplateFiles({ answers, configuration }: IOptions): Promise<Map<string, string>> {
        let templateFilenames: Array<string> = [];

        // Read the files within the path
        const fsContents = await ReadSubDirectories(this.subclassDirectory);

        // Find the templates
        const templateDir = fsContents.find(fsItem => (fsItem.fsName == `templates`));

        if (!!templateDir)
            templateFilenames = this.getDirectoryFiles(templateDir).map(filePath => filePath.replace(`${templateDir.objectPath}${path.sep}`, ``));

        Dev(templateFilenames);

        const templateFiles: Map<string, string> = new Map();
        while (templateFilenames.length > 0) {
            const filePath = templateFilenames.shift();

            // Read the file
            const fullPathToFile = path.join(this.subclassDirectory, `templates`, filePath);
            const isBinaryFile = this.isBinaryFile(fullPathToFile);
            // For now, read all non-binary as utf8, including indeterminates
            const contents = await fs.readFile(fullPathToFile, { encoding: isBinaryFile ? `base64` : `utf8` });

            templateFiles.set(this.InstallPath(filePath, { answers, configuration }), this.replaceTemplateTokens(contents, { answers, configuration }));
        }

        await this.TemplateFileAdjustments(templateFiles, { answers, configuration });

        return templateFiles;
    }

    /** Modify loaded templates, and load/remove from templates */
    public async TemplateFileAdjustments(existingTemplates: Map<string, string>, { answers, configuration }: IOptions): Promise<void> {
        return null;
    }

    public InstallDependencies({ answers, configuration }: IOptions): IDependencyList {
        return { runtime: null, development: null };
    }

    public PostInstallTasks({ answers, configuration }: IOptions): Array<IPostInstallTask> {
        return [];
    }

    public AdditionalCompositions({ answers, configuration }: IOptions): Array<IAdditionalComposition> {
        return [];
    }
}

export {
    RootComposer,
};

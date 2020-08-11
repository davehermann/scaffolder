// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { IDirectoryObject, ReadSubDirectories } from "@davehermann/fs-utilities";
import * as inquirer from "inquirer";
import { Dev } from "multi-level-logger";

// Application Modules
import { IQuestion, IAnswer, IDependencyList, IAdditionalComposition, IOptions } from "./interfaces";

abstract class RootComposer {
    /**
     * @param composerDirectory - Pass in **__dirname** from the composer
     */
    constructor(readonly subclassDirectory: string) {
        if (!subclassDirectory) throw `RootComposer requires subclasses to call super(__dirname)`;
        this.enabled = true;
    }

    /** Is this composer enabled */
    public enabled: boolean;

    /** Commit message when this completes (Leave as **undefined** for no Git commit) */
    public automaticCommitMessage: string;

    /** Used to namespace variables */
    public get namespace(): string { return path.basename(this.subclassDirectory); }

    /** Override to provide questions for the child composer */
    public Questions({ answers }: IOptions): Array<IQuestion> {
        return [];
    }

    /** Display any questions for this composer to the user */
    public async AskQuestions({ answers }: IOptions): Promise<IAnswer> {
        const questions = this.Questions({ answers });

        if (questions.length > 0) {
            const answers = await inquirer.prompt(questions);
            return answers;
        }

        return null;
    }

    /** Override to provide configuration settings */
    public SetConfiguration({ answers, configuration }: IOptions): void {
        return null;
    }

    /** Override to inject directory structure or file renaming into the path */
    public InstallPath(filePath: string, { answers, configuration }: IOptions): string {
        return filePath;
    }

    protected async AddFileOnDiskToTemplates(filePath: string, existingTemplates: Map<string, string>, { configuration }: IOptions): Promise<void> {
        // Load the file into the templates
        if (!existingTemplates.has(filePath)) {
            // Read the existing file
            const contents = await fs.readFile(path.join(configuration.rootDirectory, filePath), { encoding: `utf8` });
            existingTemplates.set(filePath, contents);
        }
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
                Dev({ source, directives, root, props });

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

                        case `substr`:
                            if (!!value)
                                value = value.substr(+data);
                            break;

                        case `replace`:
                            if (!!value) {
                                const [original, update] = data.split(`;`);
                                value = value.replace(original, update);
                            }
                            break;
                    }
                });

                if (value !== undefined)
                    fileContents = fileContents.replace(fullId, value);
            });

        return fileContents;
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
            const contents = await fs.readFile(path.join(this.subclassDirectory, `templates`, filePath), { encoding: `utf8` });

            templateFiles.set(this.InstallPath(filePath, { answers, configuration }), this.replaceTemplateTokens(contents, { answers, configuration }));
        }

        this.TemplateFileAdjustments(templateFiles, { answers, configuration });

        return templateFiles;
    }

    public TemplateFileAdjustments(templates: Map<string, string>, { answers, configuration }: IOptions): void {
        return null;
    }

    public async FileChanges(existingTemplates: Map<string, string>, { answers, configuration }: IOptions): Promise<void> {
        return null;
    }

    public InstallDependencies({ answers, configuration }: IOptions): IDependencyList {
        return { runtime: null, development: null };
    }

    public AdditionalCompositions({ answers, configuration }: IOptions): Array<IAdditionalComposition> {
        return [];
    }
}

export {
    RootComposer,
};

import * as inquirer from "inquirer";
import { IDependencyList, IAdditionalComposition, IOptions } from "./interfaces";
declare abstract class RootComposer {
    readonly subclassDirectory: string;
    /**
     * @param composerDirectory - Pass in **__dirname** from the composer
     */
    constructor(subclassDirectory: string);
    /** Is this composer enabled */
    enabled: boolean;
    /** Commit message when this completes (Leave as **undefined** for no Git commit) */
    automaticCommitMessage: string;
    /** This composer configures other composers, and does not compose templates */
    passthroughOnly: boolean;
    /** Override to provide questions for the child composer */
    Questions({ answers }: IOptions): inquirer.QuestionCollection;
    /** Display any questions for this composer to the user */
    AskQuestions({ answers }: IOptions): Promise<inquirer.Answers>;
    /**
     * Override to provide configuration settings
     *   - Set **configuration.installDestination** in your main composer to your newly created path
     */
    SetConfiguration({ answers, configuration }: IOptions): void;
    /** Override to inject directory structure or file renaming into the path */
    InstallPath(filePath: string, { answers, configuration }: IOptions): string;
    protected AddFileOnDiskToTemplates(filePath: string, existingTemplates: Map<string, string>, { configuration }: IOptions): Promise<void>;
    /**
     * Utility to drop templates
     * @param filesToRemove - file names will be automatically passed through **InstallPath** if not directly in template map
     */
    protected RemoveFromTemplates(filesToRemove: string | Array<string>, existingTemplates: Map<string, string>, { answers, configuration }: IOptions): void;
    private getDirectoryFiles;
    private replaceTemplateTokens;
    isBinaryFile(filePath: string): boolean;
    GetTemplateFiles({ answers, configuration }: IOptions): Promise<Map<string, string>>;
    /** Modify loaded templates, and load/remove from templates */
    TemplateFileAdjustments(existingTemplates: Map<string, string>, { answers, configuration }: IOptions): Promise<void>;
    InstallDependencies({ answers, configuration }: IOptions): IDependencyList;
    AdditionalCompositions({ answers, configuration }: IOptions): Array<IAdditionalComposition>;
}
export { RootComposer, };

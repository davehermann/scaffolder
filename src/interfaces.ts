import { RootComposer } from "./rootComposer";
import * as inquirer from "inquirer";

interface IAnswerCollection {
    [x:string]: inquirer.Answers;
}

interface IAdditionalComposition {
    composerName: string;
    data: IOptions;
}

interface IDependencyList {
    runtime: Array<string>;
    development: Array<string>;
}

interface IOptions {
    composer?: string;
    answers?: IAnswerCollection;
    configuration?: any;
}

/**
 * DO NOT EXPORT
 * @private
 */
interface IRegisteredComposer {
    name: string;
    path: string;
    composer: RootComposer;
    /** Internal tracking of successive composers */
    _isSubComposer?:boolean;
}

/**
 * DO NOT EXPORT
 * @private
 */
interface ISelectedComposer {
    name: string;
    registeredComposer: IRegisteredComposer;
}

export {
    IAdditionalComposition,
    IAnswerCollection,
    IDependencyList,
    IOptions,
    IRegisteredComposer,
    ISelectedComposer,
};

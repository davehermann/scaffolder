import { RootComposer } from "./rootComposer";
interface IAnswer {
    [x: string]: unknown;
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
    answers?: any;
    configuration?: any;
}
interface IQuestion {
    type: string;
    name: string;
    message?: string | ((answers: IAnswer) => string);
    default?: string | ((answers: IAnswer) => string);
    choices?: Array<IQuestionChoice> | Array<string> | Array<number>;
    when?: (answers: IAnswer) => boolean;
    validate?: (answer: string) => boolean;
    filter?: (answer: string) => string;
}
interface IQuestionChoice {
    name: string;
    value: string;
}
/**
 * DO NOT EXPORT
 * @private
 */
interface IRegisteredComposer {
    name: string;
    path: string;
    composer: RootComposer;
}
export { IAdditionalComposition, IAnswer, IDependencyList, IOptions, IQuestion, IQuestionChoice, IRegisteredComposer, };

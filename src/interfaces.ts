interface IQuestion {
    type: string;
    name: string;
    message?: string | ((answers: IAnswer) => string);
    default?: string | ((answers: IAnswer) => string);
    choices?: Array<IQuestionChoice>;
    when?: (answers: IAnswer) => boolean;
    validate?: (answer: string) => boolean;
    filter?: (answer: string) => string;
}

interface IQuestionChoice {
    name: string;
    value: string;
}

interface IAnswer {
    [x:string]: unknown;
}

interface IDependencyList {
    runtime: Array<string>;
    development: Array<string>;
}

interface IOptions {
    answers?: any;
    configuration?: any;
}

interface IAdditionalComposition {
    composerName: string;
    data: IOptions;
}

export {
    IAdditionalComposition,
    IAnswer,
    IDependencyList,
    IOptions,
    IQuestion,
    IQuestionChoice,
};

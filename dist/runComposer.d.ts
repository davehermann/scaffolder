import { IOptions, IRegisteredComposer } from "./interfaces";
declare function scaffolder(composer: IRegisteredComposer, { answers, configuration }?: IOptions, rootComposerName?: string): Promise<void>;
export { scaffolder as RunComposer, };

import { IOptions, IRegisteredComposer } from "./interfaces";
declare function scaffolder(composer: IRegisteredComposer, { answers, configuration }?: IOptions): Promise<void>;
export { scaffolder as RunComposer, };

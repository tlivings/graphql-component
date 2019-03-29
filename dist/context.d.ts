import { IGraphQLComponent, IContextConfig } from './interface.types';
export declare const builder: (component: IGraphQLComponent, ctxConfig?: IContextConfig) => (ctx: object) => object;
export declare const create: (context: (ctx: object) => object) => (object: any) => Promise<object>;
declare const _default: {
    builder: (component: IGraphQLComponent, ctxConfig?: IContextConfig) => (ctx: object) => object;
    create: (context: (ctx: object) => object) => (object: any) => Promise<object>;
};
export default _default;

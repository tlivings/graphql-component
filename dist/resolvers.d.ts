import { IGraphQLComponent, ResolverFunction } from './interface.types';
import { IResolvers } from 'graphql-tools';
export declare const memoize: (parentType: string, fieldName: string, resolve: ResolverFunction) => ResolverFunction;
export declare const transformResolvers: (resolvers: IResolvers<any, any>, excludes: string[][]) => IResolvers<any, any>;
export declare const wrapResolvers: (bind: IGraphQLComponent, resolvers: IResolvers<any, any>) => IResolvers<any, any>;
export declare const getImportedResolvers: (component: IGraphQLComponent) => IResolvers<any, any>;
declare const _default: {
    memoize: (parentType: string, fieldName: string, resolve: ResolverFunction) => ResolverFunction;
    transformResolvers: (resolvers: IResolvers<any, any>, excludes: string[][]) => IResolvers<any, any>;
    wrapResolvers: (bind: IGraphQLComponent, resolvers: IResolvers<any, any>) => IResolvers<any, any>;
    getImportedResolvers: (component: IGraphQLComponent) => IResolvers<any, any>;
};
export default _default;

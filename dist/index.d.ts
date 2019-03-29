import { GraphQLSchema, Source, DocumentNode } from 'graphql';
import { IMocks, IResolvers } from 'graphql-tools';
import { DirectiveUseMap } from 'graphql-toolkit';
import { IGraphQLComponent, IComponentOptions, ContextFunction } from './interface.types';
export declare class GraphQLComponent implements IGraphQLComponent {
    _schema: GraphQLSchema;
    _types: (string | Source | DocumentNode)[];
    _resolvers: any;
    _imports: IGraphQLComponent[];
    _directives: DirectiveUseMap;
    _context: ContextFunction;
    _importedTypes: (string | Source | DocumentNode)[];
    _importedResolvers: IResolvers<any, any>;
    _useMocks: boolean;
    _importedMocks: IMocks;
    _mocks: IMocks;
    _preserveTypeResolvers: boolean;
    _mergedTypes: DocumentNode;
    _mergedResolvers: IResolvers<any, any>;
    _fragments: string[];
    constructor({ types, resolvers, imports, mocks, directives, context, useMocks, preserveTypeResolvers }: IComponentOptions);
    static isComponent(component: any): boolean;
    execute(input: any, { root, context, variables }?: {
        root?: any;
        context?: {};
        variables?: {};
    }): Promise<any>;
    readonly schema: GraphQLSchema;
    readonly context: (object: any) => Promise<object>;
    readonly types: (string | Source | DocumentNode)[];
    readonly importedTypes: (string | Source | DocumentNode)[];
    readonly resolvers: any;
    readonly importedResolvers: IResolvers<any, any>;
    readonly imports: IGraphQLComponent[];
    readonly mocks: IMocks;
}

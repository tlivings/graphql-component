
import { GraphQLSchema, Source, DocumentNode, GraphQLResolveInfo } from 'graphql';
import { IMocks, IResolvers } from 'graphql-tools';
import { DirectiveUseMap } from 'graphql-toolkit';

export type ContextFunction = ((ctx: any) => any);

export interface IContextMiddleware {
  name: string
  fn: ContextFunction
}

export interface IContextConfig {
  namespace: string
  factory: ContextFunction
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string|ContextFunction|null, fn?: ContextFunction|string) => void
}

export interface IGraphQLComponentConfig {
  component: IGraphQLComponent
  exclude: string[]
}

export interface IGraphQLComponent {
  execute: (input: string, options: { root: any, context: {}, variables: {} }) => Promise<any>
  schema: GraphQLSchema
  types: (string | Source | DocumentNode)[]
  importedTypes: (string | Source | DocumentNode)[]
  resolvers: IResolvers<any, any>
  importedResolvers: IResolvers<any, any>
  context: ContextFunction
  imports: IGraphQLComponent[],
  mocks: IMocks
}

export interface IGraphQLComponentOptions {
  types?: (string | Source | DocumentNode)[]
  resolvers?: IResolvers<any, any>
  imports?: (IGraphQLComponent|IGraphQLComponentConfig)[]
  mocks?: MocksConfigFunction
  directives?: DirectiveUseMap
  context?: IContextConfig
  useMocks?: boolean
  preserveTypeResolvers?: boolean
};

export type MocksConfigFunction = (IMocks) => IMocks;

export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;
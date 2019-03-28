
import { GraphQLSchema, Source, DocumentNode } from 'graphql';
import { IResolverObject, IMocks } from 'graphql-tools';

export type ContextFunction = ((ctx: object) => object);

export type ComponentContextFunction = ((component: IGraphQLComponent, ctx: object) => object);

export interface IContextMiddleware {
  name: string
  fn: ((object) => object)
}

export interface IGraphQLComponentConfig {
  component: IGraphQLComponent
  exclude: string[]
}

export interface IGraphQLComponent {
  execute: (input: string, options: { root: any, context: object, variables: object }) => Promise<any>
  schema: GraphQLSchema
  types: (string | Source | DocumentNode)[]
  resolvers: IResolverObject<any, any>
  importedResolvers: IResolverObject<any, any>
  context: ContextFunction
  imports: IGraphQLComponent[],
  mocks: IMocks
}

export interface IContextConfig {
  namespace: string
  factory: ComponentContextFunction
}

export type MocksDefinition = { [k: string] : Function };

export type MocksConfigFunction = (MocksDefinition) => MocksDefinition;
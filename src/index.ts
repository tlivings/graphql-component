
import GraphQL, { GraphQLSchema, Source, DocumentNode } from 'graphql';
import Gql from 'graphql-tag';
import GraphQLTools, { IResolverObject, IMocks } from 'graphql-tools';
import GraphQLToolkit, { DirectiveUseMap } from 'graphql-toolkit';
import Resolvers from './resolvers';
import Context from './context';
import Types from './types';
import Fragments from './fragments';
import { IGraphQLComponent, MocksConfigFunction, MocksDefinition, ContextFunction, IContextConfig } from './interface.types';

import debuglog from 'debug';

const debug = debuglog('graphql-component:schema');

export default class GraphQLComponent implements IGraphQLComponent {
  _schema: GraphQLSchema
  _types: (string | Source | DocumentNode)[]
  _resolvers
  _imports: IGraphQLComponent[]
  _directives: DirectiveUseMap
  _context: ContextFunction
  _importedTypes: (string | Source | DocumentNode)[]
  _importedResolvers: IResolverObject<any, any>
  _useMocks: boolean
  _importedMocks: MocksDefinition
  _mocks: IMocks
  _preserveTypeResolvers: boolean
  _mergedTypes: DocumentNode
  _mergedResolvers: IResolverObject<any, any>
  _fragments: string[]

  constructor({
    types,
    resolvers,
    imports,
    mocks,
    directives,
    context,
    useMocks,
    preserveTypeResolvers
  }) {
    debug(`creating component`);

    this._schema = undefined;

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = Resolvers.wrapResolvers(this, resolvers);

    this._imports = [];

    this._directives = directives;

    this._context = Context.builder(this, context);

    const importedTypes = [];
    const importedResolvers = [];

    for (const imp of imports) {
      if (GraphQLComponent.isComponent(imp)) {
        importedTypes.push(...Types.getImportedTypes(imp));
        importedResolvers.push(Resolvers.getImportedResolvers(imp));
        this._imports.push(imp);
        continue;
      }

      if (!imp.exclude || !imp.exclude.length) {
        importedTypes.push(...Types.getImportedTypes(imp.component));
        importedResolvers.push(Resolvers.getImportedResolvers(imp.component));
      }
      else {
        const excludes = imp.exclude.map((filter) => {
          return filter.split('.');
        });

        importedTypes.push(...Types.getImportedTypes(imp.component, excludes));
        importedResolvers.push(Resolvers.transformResolvers(Resolvers.getImportedResolvers(imp.component), excludes));
      }

      this._imports.push(imp.component);
    }

    this._importedTypes = importedTypes;
    this._importedResolvers = GraphQLToolkit.mergeResolvers(importedResolvers);

    this._useMocks = useMocks;
    this._importedMocks = Object.assign({}, ...this._imports.map((c) => c.mocks));
    this._mocks = mocks(this._importedMocks);
    this._preserveTypeResolvers = preserveTypeResolvers;

    this._mergedTypes = GraphQLToolkit.mergeTypeDefs([...this._types, ...this._importedTypes]);
    this._mergedResolvers = GraphQLToolkit.mergeResolvers([this._resolvers, this._importedResolvers]);

    this._fragments = Fragments.buildFragments(this._mergedTypes);
  }

  static isComponent(component) {
    return !!(component.execute && component.types && component.resolvers && component.context);
  }

  async execute(input, { root = undefined, context = {}, variables = {} } = {}) : Promise<any> {
    return await GraphQL.execute({ schema: this.schema, document: Gql`${this._fragments.join('\n')}\n${input}`, rootValue: root, contextValue: context, variableValues: variables });
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    const typeDefs = this._mergedTypes;
    const resolvers = this._mergedResolvers;
    const schemaDirectives = this._directives;

    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);

      const mocks = Object.assign({}, this._importedMocks, this._mocks);

      GraphQLTools.addMockFunctionsToSchema({ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
    }

    this._schema = schema;

    return this._schema;
  }

  get context() {
    return Context.create(this._context.bind(this));
  }

  get types() {
    return this._types;
  }

  get resolvers() {
    return this._resolvers;
  }

  get importedResolvers() {
    return this._importedResolvers;
  }

  get imports() {
    return this._imports;
  }

  get mocks() {
    return this._mocks;
  }
}

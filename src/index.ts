
import { GraphQLSchema, Source, DocumentNode, execute } from 'graphql';
import Gql from 'graphql-tag';
import { IMocks, IResolvers, IMockOptions, makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { mergeResolvers, DirectiveUseMap, mergeTypeDefs } from 'graphql-toolkit';
import Resolvers from './resolvers';
import Context from './context';
import Types from './types';
import Fragments from './fragments';
import { IGraphQLComponent, IComponentOptions, ContextFunction, IGraphQLComponentConfig } from './interface.types';

import debuglog from 'debug';

const debug = debuglog('graphql-component:schema');

export class GraphQLComponent implements IGraphQLComponent {
  _schema: GraphQLSchema
  _types: (string | Source | DocumentNode)[]
  _resolvers
  _imports: IGraphQLComponent[]
  _directives: DirectiveUseMap
  _context: ContextFunction
  _importedTypes: (string | Source | DocumentNode)[]
  _importedResolvers: IResolvers<any, any>
  _useMocks: boolean
  _importedMocks: IMocks
  _mocks: IMocks
  _preserveTypeResolvers: boolean
  _mergedTypes: DocumentNode
  _mergedResolvers: IResolvers<any, any>
  _fragments: string[]

  constructor({
    types = [],
    resolvers = {},
    imports = [],
    mocks,
    directives,
    context,
    useMocks,
    preserveTypeResolvers
  }: IComponentOptions) {
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
        const component = <IGraphQLComponent>imp;
        importedTypes.push(...Types.getImportedTypes(component));
        importedResolvers.push(Resolvers.getImportedResolvers(component));
        this._imports.push(component);
        continue;
      }

      const config = <IGraphQLComponentConfig>imp;

      if (!config.exclude || !config.exclude.length) {
        importedTypes.push(...Types.getImportedTypes(config.component));
        importedResolvers.push(Resolvers.getImportedResolvers(config.component));
      }
      else {
        const excludes = config.exclude.map((filter) => {
          return filter.split('.');
        });

        importedTypes.push(...Types.getImportedTypes(config.component, excludes));
        importedResolvers.push(Resolvers.transformResolvers(Resolvers.getImportedResolvers(config.component), excludes));
      }

      this._imports.push(config.component);
    }

    this._importedTypes = importedTypes;
    this._importedResolvers = mergeResolvers(importedResolvers);

    this._useMocks = useMocks;
    this._importedMocks = Object.assign({}, ...this._imports.map((c) => c.mocks));
    this._mocks = mocks(this._importedMocks);
    this._preserveTypeResolvers = preserveTypeResolvers;

    this._mergedTypes = mergeTypeDefs([...this._types, ...this._importedTypes]);
    this._mergedResolvers = mergeResolvers([this._resolvers, this._importedResolvers]);

    this._fragments = Fragments.buildFragments(this._mergedTypes);
  }

  static isComponent(component) {
    return !!(component.execute && component.types && component.resolvers && component.context);
  }

  async execute(input, { root = undefined, context = {}, variables = {} } = {}) : Promise<any> {
    return await execute({ schema: this.schema, document: Gql`${this._fragments.join('\n')}\n${input}`, rootValue: root, contextValue: context, variableValues: variables });
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    const typeDefs = this._mergedTypes;
    const resolvers = this._mergedResolvers;
    const schemaDirectives = this._directives;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);

      const mocks: IMocks = Object.assign({}, this._importedMocks, this._mocks);

      addMockFunctionsToSchema(<IMockOptions>{ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
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

  get importedTypes() {
    return this._importedTypes;
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

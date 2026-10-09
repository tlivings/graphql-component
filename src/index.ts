import { buildFederatedSchema } from '@apollo/federation';
import { DocumentNode, GraphQLResolveInfo, GraphQLScalarType, GraphQLSchema, print } from 'graphql';

import { mergeTypeDefs } from '@graphql-tools/merge';
import {
  pruneSchema,
  IResolvers,
  PruneSchemaOptions,
  TypeSource,
  mapSchema,
  SchemaMapper
} from '@graphql-tools/utils';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { addMocksToSchema, IMocks } from '@graphql-tools/mock';
import { SubschemaConfig } from '@graphql-tools/delegate';

export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;

export interface IGraphQLComponentConfigObject {
  component: IGraphQLComponent;
  configuration?: SubschemaConfig;
}

export interface ComponentContext extends Record<string, unknown> {
  dataSources: DataSourceMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContextFunction = ((context: Record<string, unknown>) => any);

export interface IDataSource {
  name?: string;
  [key: string | symbol]: any;
}

/**
 * Type for implementing data sources
 * When defining a data source class, methods should accept context as their first parameter
 * @example
 * class MyDataSource {
 *   name = 'MyDataSource';
 *
 *   // Context is required as first parameter when implementing
 *   getData(context: ComponentContext, id: string) {
 *     return { id };
 *   }
 * }
 */
export type DataSourceDefinition<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [P in keyof T]: T[P] extends Function ? (context: ComponentContext, ...args: any[]) => any : T[P];
};

/**
 * Type for consuming data sources in resolvers
 * When using a data source method, the context is automatically injected
 * @example
 * // In a resolver:
 * Query: {
 *   getData(_, { id }, context) {
 *     // Context is automatically injected, so you don't pass it
 *     return context.dataSources.MyDataSource.getData(id);
 *   }
 * }
 */
export type DataSource<T> = {
  [P in keyof T]: T[P] extends (context: ComponentContext, ...p: infer P) => infer R ? (...p: P) => R : T[P];
};

export type DataSourceMap = { [key: string]: IDataSource };

export type DataSourceInjectionFunction = ((context?: Record<string, unknown>) => DataSourceMap);

export interface IContextConfig {
  namespace: string;
  factory: ContextFunction;
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string | ContextFunction, fn?: ContextFunction) => () => void;
}

export interface IGraphQLComponentOptions<TContextType extends ComponentContext = ComponentContext> {
  name?: string;
  types?: TypeSource;
  resolvers?: IResolvers<any, TContextType>;
  mocks?: boolean | IMocks;
  imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  context?: IContextConfig;
  dataSources?: IDataSource[];
  dataSourceOverrides?: IDataSource[];
  pruneSchema?: boolean;
  pruneSchemaOptions?: PruneSchemaOptions;
  federation?: boolean;
  transforms?: SchemaMapper[];
}

export interface IGraphQLComponent<TContextType extends ComponentContext = ComponentContext> {
  readonly name: string;
  readonly schema: GraphQLSchema;
  readonly context: IContextWrapper;
  readonly types: TypeSource;
  readonly resolvers: IResolvers<any, TContextType>;
  readonly imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  readonly dataSources?: IDataSource[];
  readonly dataSourceOverrides?: IDataSource[];
  federation?: boolean;
}

/**
 * GraphQLComponent class for building modular GraphQL schemas
 * @template TContextType - The type of the context object
 * @implements {IGraphQLComponent}
 */
export default class GraphQLComponent<TContextType extends ComponentContext = ComponentContext> implements IGraphQLComponent<TContextType> {
  private _schema: GraphQLSchema | null = null;
  private _types: TypeSource;
  private _resolvers: IResolvers<any, TContextType>;
  private _mocks: boolean | IMocks;
  private _imports: IGraphQLComponentConfigObject[];
  private _contextConfig: IContextConfig | undefined;
  private _dataSources: IDataSource[];
  private _dataSourceOverrides: IDataSource[];
  private _pruneSchema: boolean;
  private _pruneSchemaOptions: PruneSchemaOptions;
  private _federation: boolean;
  private _dataSourceContextInject: DataSourceInjectionFunction;
  private _transforms: SchemaMapper[];
  private _transformedSchema: GraphQLSchema | null = null;
  private _middleware: MiddlewareEntry[] = [];
  private _disposed = false;
  private _contextWrapper: IContextWrapper | null = null;
  private _explicitName: string | undefined;
  private _rootQueryTypeName: string;

  constructor({
    name,
    types,
    resolvers,
    mocks,
    imports,
    context,
    dataSources,
    dataSourceOverrides,
    pruneSchema,
    pruneSchemaOptions,
    federation,
    transforms
  }: IGraphQLComponentOptions) {

    this._explicitName = name;

    this._types = types ? (Array.isArray(types) ? types : [types]) : [];

    this._rootQueryTypeName = inferRootQueryTypeName(this._types);

    this._resolvers = bindResolvers(this, resolvers, this._rootQueryTypeName);

    this._mocks = mocks;

    this._federation = federation;

    this._transforms = transforms;

    this._dataSources = dataSources || [];

    this._dataSourceOverrides = dataSourceOverrides || [];

    this._dataSourceContextInject = createDataSourceContextInjector(this._dataSources, this._dataSourceOverrides);

    this._pruneSchema = pruneSchema;

    this._pruneSchemaOptions = pruneSchemaOptions;

    this._imports = imports && imports.length > 0 ? imports.map((i: IGraphQLComponent | IGraphQLComponentConfigObject) => {
      if (!i) {
        throw new Error('Import cannot be undefined or null');
      }

      // Check if it's already a config object (has 'component' property)
      if ('component' in i && i.component) {
        const comp = (i as IGraphQLComponentConfigObject).component;
        if (comp === (this as unknown as IGraphQLComponent)) {
          throw new Error(`Circular import detected: component "${this.name}" imports itself`);
        }
        return i as IGraphQLComponentConfigObject;
      }

      // Otherwise, treat it as an IGraphQLComponent and wrap it
      if ((i as IGraphQLComponent) === (this as unknown as IGraphQLComponent)) {
        throw new Error(`Circular import detected: component "${this.name}" imports itself`);
      }
      return { component: i as IGraphQLComponent };
    }) : [];

    this._contextConfig = context;

    this.validateConfig({ types, imports, mocks, federation, context, transforms });

    this.validateDataSourceCollisions();

  }

  get disposed(): boolean {
    return this._disposed;
  }

  private _assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error(`GraphQLComponent "${this.name}" has been disposed and cannot be used`);
    }
  }

  get context(): IContextWrapper {
    this._assertNotDisposed();

    if (this._contextWrapper) {
      return this._contextWrapper;
    }

    const warnedTopLevelCollisions = new Set<string>();

    const contextFn = async (incomingContext: Record<string, unknown>): Promise<ComponentContext> => {
      this._assertNotDisposed();

      const injectionRef: Record<string, unknown> = Object.assign({}, incomingContext);
      const getInjectionContext = (): Record<string, unknown> => contextForDataSourceInjection(injectionRef);
      const localDataSources = createDataSourceContextInjector(
        this._dataSources,
        this._dataSourceOverrides,
        getInjectionContext
      )();

      const syncInjectionRef = (nextCtx: Record<string, unknown>): void => {
        for (const key of Object.keys(injectionRef)) {
          delete injectionRef[key];
        }
        Object.assign(injectionRef, nextCtx);
        delete injectionRef.dataSources;
      };

      let ctx: Record<string, unknown> = Object.assign({}, incomingContext, { dataSources: localDataSources });
      syncInjectionRef(ctx);

      const middleware = [...this._middleware];
      for (const mw of middleware) {
        ctx = await mw.fn(ctx);
        ctx = Object.assign({}, ctx, { dataSources: localDataSources });
        syncInjectionRef(ctx);
      }

      if (this._contextConfig) {
        const nsCtx = await this._contextConfig.factory.call(this, ctx);
        ctx[this._contextConfig.namespace] = Object.assign({}, nsCtx);
        ctx = Object.assign({}, ctx, { dataSources: localDataSources });
        syncInjectionRef(ctx);
      }

      let importResults: ComponentContext[] = [];
      if (this._imports.length > 0) {
        importResults = await Promise.all(
          this._imports.map(({ component }) => component.context(ctx))
        );
        for (const imported of importResults) {
          mergeImportedTopLevelContext(ctx, imported, this.name, warnedTopLevelCollisions);
        }
        ctx = Object.assign({}, ctx, { dataSources: localDataSources });
        syncInjectionRef(ctx);
      }

      const dataSources: DataSourceMap = Object.assign({}, localDataSources);
      for (const imported of importResults) {
        mergeImportedDataSources(dataSources, imported.dataSources || {}, this.name, warnedTopLevelCollisions);
      }

      return Object.assign({}, ctx, { dataSources }) as ComponentContext;
    };

    contextFn.use = (name: string | ContextFunction, fn?: ContextFunction): (() => void) => {
      if (typeof name === 'function') {
        fn = name;
        name = `middleware_${this._middleware.length}`;
      }
      if (typeof fn !== 'function') {
        throw new Error(`Middleware "${name}" requires a function argument`);
      }
      const entry = { name: name as string, fn };
      this._middleware.push(entry);

      return () => {
        const index = this._middleware.indexOf(entry);
        if (index > -1) this._middleware.splice(index, 1);
      };
    };

    this._contextWrapper = contextFn;
    return contextFn;
  }

  get name(): string {
    const resolved = this._explicitName ?? this.constructor.name;
    if (!this._explicitName && resolved.length <= 2) {
      warnMinifiedConstructorName(resolved);
    }
    return resolved;
  }

  get schema(): GraphQLSchema {
    this._assertNotDisposed();
    try {
      if (this._schema) {
        return this._schema;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let makeSchema: (schemaConfig: any) => GraphQLSchema;

      if (this._federation) {
        makeSchema = buildFederatedSchema;
      }
      else {
        makeSchema = makeExecutableSchema;
      }

      if (this._imports.length > 0) {
        // iterate through the imports and construct subschema configuration objects
        const subschemas = this._imports.map((imp) => {
          const { component, configuration = {} } = imp;

          return {
            schema: component.schema,
            ...configuration
          };
        });

        // construct an aggregate schema from the schemas of imported
        // components and this component's types/resolvers (if present)
        this._schema = stitchSchemas({
          subschemas,
          typeDefs: this._types,
          resolvers: this._resolvers as IResolvers,
          mergeDirectives: true
        });
      }
      else {
        const schemaConfig = {
          typeDefs: !this._federation && Array.isArray(this._types) && this._types.length === 1 ? this._types[0] : mergeTypeDefs(this._types),
          resolvers: this._resolvers
        };

        this._schema = makeSchema(schemaConfig);
      }

      if (this._transforms) {
        this._schema = this.transformSchema(this._schema, this._transforms);
      }

      if (this._mocks === true) {
        this._schema = addMocksToSchema({ schema: this._schema, preserveResolvers: true });
      }
      else if (this._mocks && typeof this._mocks === 'object') {
        this._schema = addMocksToSchema({ schema: this._schema, mocks: this._mocks, preserveResolvers: true });
      }

      if (this._pruneSchema) {
        this._schema = pruneSchema(this._schema, this._pruneSchemaOptions);
      }

      return this._schema;
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create schema for component ${this.name}: ${message}`, { cause: err });
    }
  }

  get types(): TypeSource {
    this._assertNotDisposed();
    return this._types;
  }

  get resolvers(): IResolvers<any, TContextType> {
    this._assertNotDisposed();
    return this._resolvers;
  }

  get imports(): IGraphQLComponentConfigObject[] {
    this._assertNotDisposed();
    return this._imports;
  }

  get dataSources(): IDataSource[] {
    this._assertNotDisposed();
    return this._dataSources;
  }

  get dataSourceOverrides(): IDataSource[] {
    this._assertNotDisposed();
    return this._dataSourceOverrides;
  }

  set federation(flag) {
    this._federation = flag;
    this.invalidateSchema();
  }

  get federation(): boolean {
    return this._federation;
  }

  public dispose(): void {
    this._disposed = true;
    this._schema = null;
    this._transformedSchema = null;
    this._types = null as unknown as TypeSource;
    this._resolvers = null as unknown as IResolvers;
    this._imports = null as unknown as IGraphQLComponentConfigObject[];
    this._dataSources = null as unknown as IDataSource[];
    this._dataSourceOverrides = null as unknown as IDataSource[];
    this._mocks = null as unknown as boolean | IMocks;
    this._contextConfig = undefined;
    this._dataSourceContextInject = null as unknown as DataSourceInjectionFunction;
    this._transforms = null as unknown as SchemaMapper[];
    this._middleware = [];
    this._contextWrapper = null;
  }

  private transformSchema(schema: GraphQLSchema, transforms: SchemaMapper[]): GraphQLSchema {
    if (this._transformedSchema) {
      return this._transformedSchema;
    }

    const functions: Record<string, ((...args: unknown[]) => unknown)[]> = {};
    const mapping: Record<string, (...args: unknown[]) => unknown> = {};

    for (const transform of transforms) {
      for (const [key, fn] of Object.entries(transform)) {
        if (!mapping[key]) {
          functions[key] = [];
          mapping[key] = function (...args: unknown[]) {
            let current: unknown = args[0];
            let mapped = false;
            for (const mapper of functions[key]) {
              const next = mapped
                ? mapper(current, ...args.slice(1))
                : mapper(...args);
              if (next === null) {
                return null;
              }
              if (next !== undefined) {
                current = next;
                mapped = true;
              }
            }
            return mapped ? current : args[0];
          };
        }
        functions[key].push(fn);
      }
    }

    this._transformedSchema = mapSchema(schema, mapping);
    return this._transformedSchema;
  }

  public invalidateSchema(): void {
    this._schema = null;
    this._transformedSchema = null;
  }

  private validateConfig(options: IGraphQLComponentOptions): void {
    if (options.federation && !options.types) {
      throw new Error('Federation requires type definitions');
    }

    if (options.mocks !== null && options.mocks !== undefined
        && typeof options.mocks !== 'boolean' && typeof options.mocks !== 'object') {
      throw new Error('mocks must be either boolean or object');
    }

    if (options.context) {
      if (!options.context.namespace || typeof options.context.namespace !== 'string') {
        throw new Error('context.namespace must be a non-empty string');
      }
      if (options.context.namespace === 'dataSources') {
        throw new Error('context.namespace cannot be "dataSources" as it would shadow the data source map');
      }
      if (typeof options.context.factory !== 'function') {
        throw new Error('context.factory must be a function');
      }
    }

    if (options.transforms !== undefined && !Array.isArray(options.transforms)) {
      throw new Error('transforms must be an array');
    }
  }

  private validateDataSourceCollisions(): void {
    if (this._imports.length === 0) {
      return;
    }

    const parentKeys = dataSourceKeysForComponent(this._dataSources, this._dataSourceOverrides);
    const overrideKeys = new Set(
      this._dataSourceOverrides.map((ds) => resolveDataSourceKey(ds))
    );
    const siblingByKey = new Map<string, { component: IGraphQLComponent; ctor: IDataSource['constructor'] }>();
    const warned = new Set<string>();

    for (const { component } of this._imports) {
      const importKeys = collectImportDataSourceKeys(component);
      for (const dsKey of importKeys) {
        if (parentKeys.has(dsKey) && !overrideKeys.has(dsKey) && !warned.has(dsKey)) {
          warned.add(dsKey);
          console.warn(
            `GraphQLComponent "${this.name}": data source key "${dsKey}" is defined on this component and on an import; ` +
            'the parent instance wins at runtime. Use dataSourceOverrides to replace an import data source intentionally.'
          );
        }
      }

      for (const dataSource of component.dataSources || []) {
        const dsKey = resolveDataSourceKey(dataSource);
        const prior = siblingByKey.get(dsKey);
        if (!prior) {
          siblingByKey.set(dsKey, { component, ctor: dataSource.constructor });
          continue;
        }
        if (prior.component === component) {
          continue;
        }
        if (prior.ctor === dataSource.constructor) {
          continue;
        }
        if (!overrideKeys.has(dsKey)) {
          throw new Error(
            `GraphQLComponent "${this.name}": data source key "${dsKey}" is defined by multiple imports with different implementations. ` +
            'Add dataSourceOverrides on the parent to select which implementation to use.'
          );
        }
      }
    }
  }

}

// For backward compatibility with CommonJS require()
module.exports = GraphQLComponent;
module.exports.default = GraphQLComponent;

const minifiedNameWarnings = new Set<string>();

function warnMinifiedConstructorName(name: string): void {
  if (minifiedNameWarnings.has(name)) {
    return;
  }
  minifiedNameWarnings.add(name);
  console.warn(
    `GraphQLComponent: constructor.name "${name}" looks minified; set the explicit "name" option for stable component and data source keys.`
  );
}

function resolveDataSourceKey(dataSource: IDataSource): string {
  return dataSource.name != null && dataSource.name !== ''
    ? dataSource.name
    : dataSource.constructor.name;
}

function dataSourceKeysForComponent(dataSources: IDataSource[], overrides: IDataSource[]): Set<string> {
  const keys = new Set<string>();
  for (const ds of dataSources) {
    keys.add(resolveDataSourceKey(ds));
  }
  for (const ds of overrides) {
    keys.add(resolveDataSourceKey(ds));
  }
  return keys;
}

function collectImportDataSourceKeys(component: IGraphQLComponent): Set<string> {
  const keys = dataSourceKeysForComponent(component.dataSources || [], component.dataSourceOverrides || []);
  for (const imp of component.imports || []) {
    const nested = collectImportDataSourceKeys('component' in imp ? imp.component : imp);
    for (const key of nested) {
      keys.add(key);
    }
  }
  return keys;
}

function typeSourceToSdl(source: unknown): string | null {
  if (typeof source === 'string') {
    return source;
  }
  if (source && typeof source === 'object' && (source as DocumentNode).kind === 'Document') {
    return print(source as DocumentNode);
  }
  return null;
}

function inferRootQueryTypeName(types: TypeSource): string {
  const sources = Array.isArray(types) ? types : [types];
  for (const source of sources) {
    const sdl = typeSourceToSdl(source);
    if (!sdl) {
      continue;
    }
    const match = sdl.match(/schema\s*\{[^}]*\bquery\s*:\s*(\w+)/i);
    if (match) {
      return match[1];
    }
  }
  return 'Query';
}

function contextForDataSourceInjection(ctx: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...ctx };
  delete clone.dataSources;
  return clone;
}

function mergeImportedTopLevelContext(
  target: Record<string, unknown>,
  imported: ComponentContext,
  componentName: string,
  warnedCollisions: Set<string>
): void {
  for (const [key, value] of Object.entries(imported)) {
    if (key === 'dataSources') {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      if (target[key] !== value) {
        if (!warnedCollisions.has(`ctx:${key}`)) {
          warnedCollisions.add(`ctx:${key}`);
          console.warn(
            `GraphQLComponent "${componentName}": top-level context key "${key}" from an import was ignored because the parent context already defines it.`
          );
        }
      }
      continue;
    }
    target[key] = value;
  }
}

function mergeImportedDataSources(
  target: DataSourceMap,
  imported: DataSourceMap,
  componentName: string,
  warnedCollisions: Set<string>
): void {
  for (const [dsName, ds] of Object.entries(imported)) {
    if (Object.prototype.hasOwnProperty.call(target, dsName)) {
      if (!warnedCollisions.has(`ds:${dsName}`)) {
        warnedCollisions.add(`ds:${dsName}`);
        console.warn(
          `GraphQLComponent "${componentName}": data source "${dsName}" from an import was ignored because the parent already defines it.`
        );
      }
      continue;
    }
    target[dsName] = ds;
  }
}

/**
 * Wraps data sources with a proxy that intercepts calls to data source methods and injects the current context
 * @param {IDataSource[]} dataSources
 * @param {IDataSource[]} dataSourceOverrides
 * @returns {DataSourceInjectionFunction} a function that returns a map of data sources with methods that have been intercepted
 */
function createDataSourceContextInjector(
  dataSources: IDataSource[],
  dataSourceOverrides: IDataSource[],
  getInjectionContext?: () => Record<string, unknown>
): DataSourceInjectionFunction {
  function intercept(instance: IDataSource, resolveContext: () => Record<string, unknown>) {
    // Cache wrapped functions per proxy to avoid creating new wrappers on every property access
    const wrappedMethods = new Map<string | symbol, (...args: unknown[]) => unknown>();

    return new Proxy(instance, {
      get(target, key) {
        if (typeof target[key] !== 'function' || key === instance.constructor.name) {
          return target[key];
        }

        let wrapped = wrappedMethods.get(key);
        if (!wrapped) {
          const original = target[key];
          wrapped = function (...args: unknown[]) {
            return original.call(instance, resolveContext(), ...args);
          };
          wrappedMethods.set(key, wrapped);
        }

        return wrapped;
      }
    }) as DataSource<typeof instance>;
  }

  return function (context: Record<string, unknown> = {}): DataSourceMap {
    const resolveContext = getInjectionContext ?? (() => contextForDataSourceInjection(context));
    const proxiedDataSources: DataSourceMap = {};

    // Inject data sources
    for (const dataSource of dataSources) {
      proxiedDataSources[dataSource.name != null && dataSource.name !== '' ? dataSource.name : dataSource.constructor.name] = intercept(dataSource, resolveContext);
    }

    // Override data sources
    for (const dataSourceOverride of dataSourceOverrides) {
      proxiedDataSources[dataSourceOverride.name != null && dataSourceOverride.name !== '' ? dataSourceOverride.name : dataSourceOverride.constructor.name] = intercept(dataSourceOverride, resolveContext);
    }

    return proxiedDataSources;
  };
}

/**
 * memoizes resolver functions such that calls of an identical resolver (args/context/path) within the same request context are avoided
 * @param {string} parentType - the type whose field resolver is being
 * wrapped/memoized
 * @param {string} fieldName -  the field on the parentType whose resolver
 * function is being wrapped/memoized
 * @param {function} resolve - the resolver function that parentType.
 * fieldName is mapped to
 * @returns {function} a function that wraps the input resolver function and
 * whose closure scope contains a WeakMap to achieve memoization of the wrapped
 * input resolver function
 */
const stableStringify = function (args: Record<string, unknown>): string {
  if (!args || typeof args !== 'object') return String(args);
  const keys = Object.keys(args);
  if (keys.length === 0) return '{}';
  keys.sort();
  return keys.map(k => {
    let v: string;
    if (typeof args[k] === 'object') {
      try {
        v = JSON.stringify(args[k]);
      }
      catch {
        v = '[circular]';
      }
    }
    else {
      v = String(args[k]);
    }
    return `${k}:${v}`;
  }).join(',');
};

const memoize = function (parentType: string, fieldName: string, resolve: ResolverFunction): ResolverFunction {
  const _cache = new WeakMap();

  return function _memoizedResolver(_, args, context, info) {
    const path = info && info.path && info.path.key;
    const key = `${path}_${stableStringify(args)}`;

    let cached = _cache.get(context);

    if (cached && Object.prototype.hasOwnProperty.call(cached, key)) {
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    return result;
  };
};

/**
 * make 'this' in resolver functions equal to the input bindContext
 * @param {Object} bind - the object context to bind to resolver functions
 * @param {Object} resolvers - the resolver map containing the resolver
 * functions to bind
 * @returns {Object} - an object identical in structure to the input resolver
 * map, except with resolver function bound to the input argument bind
 */
const bindResolvers = function (
  bindContext: IGraphQLComponent,
  resolvers: IResolvers = {},
  rootQueryTypeName = 'Query'
): IResolvers {
  const boundResolvers: Record<string, Record<string, unknown> | GraphQLScalarType> = {};

  for (const [type, fields] of Object.entries(resolvers)) {
    // dont bind an object that is an instance of a graphql scalar
    if (fields instanceof GraphQLScalarType) {
      boundResolvers[type] = fields;
      continue;
    }

    if (!boundResolvers[type]) {
      boundResolvers[type] = {};
    }

    const typeResolvers = boundResolvers[type] as Record<string, unknown>;

    for (const [field, resolver] of Object.entries(fields)) {
      if (typeof resolver === 'function') {
        if (type === rootQueryTypeName) {
          typeResolvers[field] = memoize(type, field, resolver.bind(bindContext));
        }
        else {
          typeResolvers[field] = resolver.bind(bindContext);
        }
      }
      else {
        typeResolvers[field] = resolver;
      }
    }
  }

  return boundResolvers as IResolvers;
};

interface MiddlewareEntry {
  name: string;
  fn: ContextFunction;
}
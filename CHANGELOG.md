### v7.0.0

- [BREAKING] Context pipeline order: middleware and namespace run before import data sources are merged. This component’s data source proxies are available in middleware (local data sources only, not imports) and read context updated after each middleware step, namespace, and import merge; resolvers receive the finished context including import data sources.
- [BREAKING] Import precedence: parent top-level context keys and data source keys win over imports. Sibling imports that reuse the same data source **constructor** for the same key are deduped silently at construction and runtime (first import wins). Sibling or **cousin** imports (including nested imports) with the same key but **different** implementations throw at construction unless the parent sets `dataSourceOverrides` for that key. Runtime data source merging is silent; collisions are resolved at construction time.
- [BREAKING] Namespace context is assigned as a fresh object per request under the configured namespace key, avoiding in-place mutation races between parallel imports.
- [FIX] Removed duplicate per-request injection of imported data sources (import data sources are merged only via each import’s context function).
- [FIX] Schema `transforms` mappers of the same kind now chain, with each mapper receiving the previous mapper’s result.
- [FIX] Query resolver memoization caches falsy return values and applies to the schema root query type (including custom `schema { query: ... }` names), not only a type literally named `Query`.
- [FEATURE] Optional `name` constructor option for stable component naming when `constructor.name` is minified (warns when the inferred name is 1–2 characters).
- [BREAKING] Replaced deprecated `@apollo/federation` with `@apollo/subgraph` (`buildSubgraphSchema`, `^2.15.1`). Federation 2 `@link` SDL is supported; Federation 1 SDL without `@link` continues to work.
- [BREAKING] **Node.js >= 22** is required (`engines.node` and CI on Node 22/24).
- [BREAKING] `federation: true` with `imports` now merges branded `GraphQLComponent` definitions into one subgraph (including `__resolveReference`) instead of silently omitting `_service`. Any non-empty import `configuration` throws at construction (first key reported). Imported `transforms`/`mocks`, duplicate `__resolveReference` for the same type, and incompatible federation `@link` URLs across merges also throw at construction.

#### Migration

- Middleware may still call **this component’s** `context.dataSources`; import data sources appear only on the context returned after import resolution. Auth-via-data-source in middleware remains supported for local data sources.
- If you depended on imports overwriting parent data sources or top-level context keys, use `dataSourceOverrides` or rename keys / namespaces explicitly.
- Sibling imports with the same data source key now throw at construction when implementations differ; use `dataSourceOverrides` on the parent or align implementations (same class) / rename keys.
- Set `name` on components in minified production bundles for stable logging and collision warnings.
- Remove `@apollo/federation` from your app dependencies; use `@apollo/subgraph` (pulled in by this package) for any direct subgraph utilities.
- Federated components with imports that relied on stitched remote subschemas must use non-federated stitching at the gateway boundary, or colocate mergeable subgraph SDL on branded `GraphQLComponent` imports only.
- Federated merge rejects any import `configuration` (not a blocklist): use non-federated stitching for `SubschemaConfig` options such as `executor`, `schema`, or `transforms`.
- Do not put `transforms` or `mocks` on imported components in a federated merge; apply them on the root federated component or use non-federated stitching.
- Align on one federation `@link` version across merged components, or use Fed 1 SDL without `@link` alongside a single Fed 2 `@link`.
- Only one imported component may define `__resolveReference` per entity type.
- Upgrade runtime to **Node 22+** before adopting v7 (required by `@apollo/subgraph` 2.15+).

### v6.0.3

- [FIX] Import handling now supports both `GraphQLComponent` instances and custom `IGraphQLComponent` implementations, not just class instances
- [FIX] Changed import normalization from `instanceof GraphQLComponent` check to property-based detection, ensuring all components are properly wrapped
- [TESTS] Added comprehensive tests validating import handling for `GraphQLComponent` instances, `IGraphQLComponent` implementations, and mixed import scenarios

### v6.0.2

- [FIX] DataSources are now available in middleware context, enabling middleware to access component dataSources for authentication and other operations
- [TESTS] Added test to verify dataSources availability in middleware
- [PERFORMANCE] Enhanced context building with parallel import processing, and middleware optimization
- [TESTS] Added comprehensive performance regression tests to validate optimization correctness and prevent breaking changes
- [SECURITY] Removed `debug`

### v6.0.1

- Re-release after merge

### v6.0.0

- Converted to TS
- BREAKING removed `delegateToComponent`
- BREAKING excludes removed as an option in import configuration. Transforms used instead as part of a `SubschemaConfig`.
- BREAKING upgraded to graphql 16.9+ peer
- BREAKING datasource injected context does not contain `datasources`

===

### v5.0.1

- Update @graphql-tools/utils dependency and fix samples for Apollo server v3.

### v5.0.0

- Update graphql peer-dependency for Apollo server v3.

### v4.0.0

- Updated @apollo/federation dependency for Node 18 compatibility.
- Drop Node 12 compatibility.

### v3.1.0

- Updated graphql-tools dependency to fix security vulnerabilities

### v3.0.4

- Updated schema pruning dependency and TS definitions

### v3.0.3

- [FIXED] - imported components directives are merged into final schema

### v3.0.2

- schema pruning and remove broken makeExecutableSchema override

### v3.0.1

- [FIXED] - if `exclude` is undefined in a component config

### v3.0.0

- Modernized to utilize new graphql-tools
- [BREAKING] - directives are not imported and maintained throughout the tree : top level component is responsible for directive implementations

### v2.2.0

- [FEATURE] - Add "hook" for custom `makeExecutableSchema` function

### v2.1.7

- [FIXED] - Explicitly removed wrapping of the federation `__resolveReference()` resolver which was preventing `__resolveReference()` from running when using `graphql-component` to build federated schemas in seperate graphql services.

### v2.1.6

- [FIXED] - A bug with `graphql-component` being used in a federated schema was brought to our attention and was attributed to the non-root type field resolver wrapping performed to help prevent double execution of resolvers with local delegation. Effectively, the resolver wrapping functionality was causing a null value to be returned (by attempting to return a value from the root arg) when the wrapper should have been calling through to the actual resolver. To fix this, separate wrapper functions are used for fields that begin with `__` (such as `__resolveType()`) versus "normal" non-root type fields. These separated wrapper functions look for similar but slightly different conditions to determine whether to "short circuit" an already computed result which ensures that the wrapper functions are short circuiting or calling through to the actual resolver in the desired situations.

### v2.1.5

- [FIXED] - delegateToComponent()'s second parameter is an options object that supports an `args` key for passing arguments to the target GraphQL operation via JavaScript from the calling resolver. Previously, if you attempted to pass an array (wrapping any form of JavaScript scalar) a type coersion error would surface. delegateToComponent's options.args parameter now supports passing Array like arguments as expected.

### v2.1.4

- [REVERT] - reverting both fixes in [2.1.2](https://github.com/ExpediaGroup/graphql-component/releases/tag/v2.1.2). The change made to unify exclusions and return pre-computed results from non-root resolvers resulted in non-root resolvers not executing when they should have. Being able to exclude non-root resolvers (not their types) is a valid work around in certain situations.

### v2.1.3

- [FIXED] - modified automatic pruning mechanism during delegation to use parent types/parent type fields instead of getFieldDef()

### v2.1.2

- [FIXED] - non-root resolvers being executed twice in certain delegate situations
- [FIXED] - resolver exclusion now works identical to type exclusion. Only root types (`Query`, `Mutation`, `Subscription`) and/or fields on root types can be excluded, which was not the case for resolver functions prior to this fix.

### v2.1.1

- update `@apollo/federation` to `^0.20.4`

### v2.1.0

- [FEATURE] `delegateToComponent()` - automatically prune fields from the delegated document selection set that are not defined in the schema (component) being delegated to. This will reduced potential down stream errors as well as ensures no unintended fields are forwarded and all fields forwarded can be resolved by the schema be delegated to. This feature addresses some edge cases around variable forwarding that were not addressed in prior patch releases `2.0.4` and `2.0.5`.

### v2.0.5

- [FIXED] Reinstated variable passing to the sub-document created by `delegateToComponent()`. All variable values will be forwarded to the delegated operation, but only the variable definitions for input types or types that are in the target schema will be forwarded. This prevents errors in certain delegate situations while also allowing valid resolution of args passed as variables.

### v2.0.4

- [FIXED] the error path on errors surfaced through `delegateToComponent()` calls such that error path takes into account the already traversed path and exclusions
- [FIXED] Variables from an outer operation are no longer forwarded to the sub operation created by `delegateToComponent()` this is to avoid passing along variables for types that dont exist in the schema being delegated to.

### v2.0.3

- [FIXED] individual field exclusions during import - individual field exclusions will no longer modify the original resolver map that is being imported.
- [FIXED] tightened up argument forwarding when using `delegateToComponent()` - only arguments the target field is expecting will be extracted from the calling resolver or from the `args` object provided to `delegateToComponent()` depending on the situation. Previously, there were some unintended argument leakage in certain edge cases.

### v2.0.2

- [FIXED] importing directives

### v2.0.1

- [FIXED] error merging to iteratively consider the merge path to properly merge errors in complex situations such as lists

### v2.0.0

- [BREAKING] removed fragment helpers
- [BREAKING] `schemaDirectives` (which returned merged directives) removed from component api
- [BREAKING] removed `proxyImportedResolvers` feature flag
- [BREAKING] removed `execute`
- [FEATURE] added `delegateToComponent` to replace `execute`
- [FEATURE] args can be overridden/passed via `delegateToComponent`
- [FEATURE] added `targetRootField` option to `delegateToComponent`
- [FIXED] delegation for subscription operations
- [FIXED] Memoizing resolvers didn't take into account aliased requests
- [FIXED] delegating an operation that contains an abstract type
- [DOCS] added documentation for `delegateToComponent`
- [CLEANUP] use fieldNodes to build sub-operation document in delegateToComponent such that the original operation document isn't unintentionally modified
- [CLEANUP] removal of proxy resolvers creation when importing resolvers
- [CLEANUP] Refactor how imports are merged together to be optimized and only run when a schema is requested
- [CLEANUP] Moved tests alongside source code

### v1.3.1

- Fixed exclude mapping in GraphQLComponent constructor - Array.map was erroniously changed to Array.filter

### v1.3.0

- Imported resolvers will delegate to the imported component schema to which they belong.
- Remove `this._context` as default value for context in `execute()` requiring `execute()` users to pass in context from a calling resolver.
- Remove binding of `GraphQLComponent` class context to Subscription resolvers.
- Apply proxyImportedResolvers regardless of how the way a component is imported and whether or not exclusions are provided. proxyImportedResolvers can still be turned off for an imported component if the component is passed via config object.

### v1.2.4

- Execute flag `mergeErrors` allows inline errors to facilitate returning multiple errors from resolvers that use `execute`.

### v1.2.3

- Allow extended properties in federated schema with custom directives

### v1.2.2

- Allow custom directives in federation (#40)

### v1.2.1

- Clean up empty types that were excluded (#38)
- Reduced package size with npmignore

### v1.2.0

- Added federation support
- New license copyright

### v1.1.3

- Fixed data source proxy losing instance binding
- Upgraded to graphql peer ^14

### v1.1.1

- `execute` now supports both document objects and strings.

### v1.1.1

- [BREAKING from 1.1.0 (sorry, but it is 5 minutes later)]: data sources appear by constructor name on context

### v1.1.0

- Added first class data source support and overriding

### v1.0.4

- Fixes #23

### v1.0.3

- Disabling type resolvers from memoization — this doesn't work right for type resolvers.

### v1.0.2

- Outer global context setup occurs only once when `context` is fetched off component.

### v1.0.1

- Fixed .npmignore to not include misc files that added to the package size

### v1.0.0 — promoted from alpha.23

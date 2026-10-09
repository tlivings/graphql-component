import test from 'tape';
import sinon from 'sinon';
import { graphql, parse } from 'graphql';
import GraphQLComponent, { IGraphQLComponent } from '../src/index';
import { MapperKind } from '@graphql-tools/utils';
import { GraphQLFieldConfig } from 'graphql';

test('Composition regression (v7 context, transforms, memoize)', (t) => {
  t.test('data sources receive middleware and namespace context', async (assert) => {
    class AuthAwareDataSource {
      name = 'authAware';
      readUser(context: Record<string, unknown>) {
        return context.userId;
      }
    }

    const component = new GraphQLComponent({
      types: 'type Query { test: String }',
      dataSources: [new AuthAwareDataSource()],
      context: {
        namespace: 'app',
        factory: async () => ({ region: 'us-west' })
      }
    });

    component.context.use('auth', async (ctx) => ({
      ...ctx,
      userId: 'user-42'
    }));

    const ctx = await component.context({});
    assert.equal(ctx.dataSources.authAware.readUser(), 'user-42', 'middleware value visible to data source');
    assert.equal((ctx as Record<string, unknown>).app && (ctx as { app: { region: string } }).app.region, 'us-west', 'namespace visible on context');
    assert.end();
  });

  t.test('import data sources are built once via import context (no duplicate injection)', async (assert) => {
    let childContextInvocations = 0;

    const child: IGraphQLComponent = {
      get name() {
        return 'ChildComponent';
      },
      get schema() {
        return new GraphQLComponent({ types: 'type Query { child: String }' }).schema;
      },
      get types() {
        return ['type Query { child: String }'];
      },
      get resolvers() {
        return {};
      },
      get context() {
        const fn = async (ctx: Record<string, unknown>) => {
          childContextInvocations++;
          const leaf = new GraphQLComponent({
            name: 'Leaf',
            types: 'type Query { leaf: String }',
            dataSources: [{ name: 'counter', ping: () => 'ok' }]
          });
          return leaf.context(ctx);
        };
        fn.use = () => () => {};
        return fn;
      }
    };

    const parent = new GraphQLComponent({
      name: 'ParentComponent',
      types: 'type Query { parent: String }',
      imports: [child]
    });

    await parent.context({});
    await parent.context({});
    assert.equal(childContextInvocations, 2, 'each parent context build invokes import context once');
    assert.end();
  });

  t.test('parent data source wins over import with same key', async (assert) => {
    class ParentDS {
      name = 'shared';
      getValue() {
        return 'parent';
      }
    }
    class ChildDS {
      name = 'shared';
      getValue() {
        return 'child';
      }
    }

    const child = new GraphQLComponent({
      name: 'Child',
      types: 'type Query { c: String }',
      dataSources: [new ChildDS()]
    });

    const parent = new GraphQLComponent({
      name: 'Parent',
      types: 'type Query { p: String }',
      dataSources: [new ParentDS()],
      imports: [child]
    });

    const ctx = await parent.context({});
    assert.equal(ctx.dataSources.shared.getValue(), 'parent', 'parent data source wins');
    assert.end();
  });

  t.test('parent top-level context wins over import', async (assert) => {
    const child = new GraphQLComponent({
      name: 'Child',
      types: 'type Query { c: String }',
      context: {
        namespace: 'child',
        factory: async () => ({ token: 'child-token' })
      }
    });

    const parent = new GraphQLComponent({
      name: 'Parent',
      types: 'type Query { p: String }',
      imports: [child]
    });

    parent.context.use('auth', async (ctx) => ({
      ...ctx,
      token: 'parent-token'
    }));

    const ctx = await parent.context({});
    assert.equal(ctx.token, 'parent-token', 'parent middleware value kept');
    assert.equal(ctx.child.token, 'child-token', 'import namespace still merged');
    assert.end();
  });

  t.test('parallel imports use isolated namespace objects', async (assert) => {
    const makeImport = (ns: string, delay: number) => new GraphQLComponent({
      name: ns,
      types: 'type Query { q: String }',
      context: {
        namespace: ns,
        factory: async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return { marker: ns };
        }
      }
    });

    const parent = new GraphQLComponent({
      name: 'Parent',
      types: 'type Query { p: String }',
      imports: [makeImport('alpha', 15), makeImport('beta', 1)]
    });

    const ctx = await parent.context({});
    assert.equal((ctx as { alpha: { marker: string } }).alpha.marker, 'alpha', 'alpha namespace isolated');
    assert.equal((ctx as { beta: { marker: string } }).beta.marker, 'beta', 'beta namespace isolated');
    assert.end();
  });

  t.test('nested imports (3 levels) produce no false-positive context collision warnings', async (assert) => {
    const warn = sinon.stub(console, 'warn');

    const level3 = new GraphQLComponent({
      name: 'L3',
      types: 'type Query { l3: String }',
      context: {
        namespace: 'l3',
        factory: async (ctx: Record<string, unknown>) => ({
          sawRoot: Boolean(ctx.rootFlag),
          sawL2: Boolean((ctx.l2 as { ready?: boolean } | undefined)?.ready)
        })
      }
    });

    const level2 = new GraphQLComponent({
      name: 'L2',
      types: 'type Query { l2: String }',
      imports: [level3],
      context: {
        namespace: 'l2',
        factory: async () => ({ ready: true })
      }
    });

    const root = new GraphQLComponent({
      name: 'L1',
      types: 'type Query { l1: String }',
      imports: [level2]
    });

    root.context.use('root', async (ctx) => ({ ...ctx, rootFlag: true }));

    const ctx = await root.context({});
    const ignoredKeyWarnings = warn.getCalls().filter((c) => String(c.args[0]).includes('top-level context key'));
    assert.equal(ignoredKeyWarnings.length, 0, 'no spurious top-level collision warnings');
    assert.ok(ctx.rootFlag, 'root middleware applied');
    assert.ok(ctx.l2.ready, 'level2 namespace present');
    assert.equal(ctx.l3.sawRoot, true, 'level3 factory saw root middleware through import chain');
    assert.equal(ctx.l3.sawL2, true, 'level3 factory saw level2 namespace before import processing');
    warn.restore();
    assert.end();
  });

  t.test('import middleware runs after parent middleware', async (assert) => {
    const child = new GraphQLComponent({
      name: 'Child',
      types: 'type Query { c: String }'
    });

    child.context.use('child', async (ctx: Record<string, unknown>) => ({
      ...ctx,
      fromChild: (ctx.fromParent as string) + '-child'
    }));

    const parent = new GraphQLComponent({
      name: 'Parent',
      types: 'type Query { p: String }',
      imports: [child]
    });

    parent.context.use('parent', async (ctx) => ({
      ...ctx,
      fromParent: 'parent'
    }));

    const ctx = await parent.context({});
    assert.equal(ctx.fromParent, 'parent', 'parent middleware value on context');
    assert.equal(ctx.fromChild, 'parent-child', 'child middleware saw parent output');
    assert.end();
  });

  t.test('schema transforms continue chaining when a mapper returns undefined', (assert) => {
    let secondRan = false;
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }',
      resolvers: { Query: { hello: () => 'world' } },
      transforms: [
        {
          [MapperKind.OBJECT_FIELD]: (field: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
            if (fieldName !== 'hello') {
              return field;
            }
            return undefined;
          }
        },
        {
          [MapperKind.OBJECT_FIELD]: (field: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
            if (fieldName !== 'hello') {
              return field;
            }
            secondRan = true;
            return { ...field, description: 'step-two' };
          }
        }
      ]
    });

    const description = component.schema.getQueryType()?.getFields().hello.description;
    assert.ok(secondRan, 'second mapper ran after undefined from first');
    assert.equal(description, 'step-two', 'chained transform applied');
    assert.end();
  });

  t.test('schema transforms chain in configuration order', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }',
      resolvers: { Query: { hello: () => 'world' } },
      transforms: [
        {
          [MapperKind.OBJECT_FIELD]: (field: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
            if (fieldName !== 'hello') {
              return field;
            }
            return { ...field, description: 'step-one' };
          }
        },
        {
          [MapperKind.OBJECT_FIELD]: (field: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
            if (fieldName !== 'hello') {
              return field;
            }
            return { ...field, description: `${field.description ?? ''}-step-two` };
          }
        }
      ]
    });

    const description = component.schema.getQueryType()?.getFields().hello.description;
    assert.equal(description, 'step-one-step-two', 'transform mappers compose sequentially');
    assert.end();
  });

  t.test('sibling imports with same data source class dedupe silently', (assert) => {
    class SharedDS {
      name = 'shared';
      tag: string;
      constructor(tag: string) {
        this.tag = tag;
      }
      getTag() {
        return this.tag;
      }
    }

    const comp1 = new GraphQLComponent({
      name: 'CompOne',
      types: 'type Query { a: String }',
      dataSources: [new SharedDS('one')]
    });
    const comp2 = new GraphQLComponent({
      name: 'CompTwo',
      types: 'type Query { b: String }',
      dataSources: [new SharedDS('two')]
    });

    assert.doesNotThrow(() => {
      new GraphQLComponent({
        name: 'Parent',
        types: 'type Query { p: String }',
        imports: [comp1, comp2]
      });
    }, 'same constructor sibling collision is silent');
    assert.end();
  });

  t.test('sibling imports with different data source implementations throw without override', (assert) => {
    class DsA {
      name = 'users';
      who() {
        return 'a';
      }
    }
    class DsB {
      name = 'users';
      who() {
        return 'b';
      }
    }

    const comp1 = new GraphQLComponent({
      name: 'CompOne',
      types: 'type Query { a: String }',
      dataSources: [new DsA()]
    });
    const comp2 = new GraphQLComponent({
      name: 'CompTwo',
      types: 'type Query { b: String }',
      dataSources: [new DsB()]
    });

    assert.throws(() => {
      new GraphQLComponent({
        name: 'Parent',
        types: 'type Query { p: String }',
        imports: [comp1, comp2]
      });
    }, /different implementations/, 'throws when sibling imports disagree');
    assert.end();
  });

  t.test('parent dataSourceOverrides suppress collision warning and win for import resolvers', async (assert) => {
    const warn = sinon.stub(console, 'warn');

    class ImportUsers {
      name = 'users';
      who() {
        return 'import';
      }
    }
    class OverrideUsers {
      name = 'users';
      who() {
        return 'override';
      }
    }

    const child = new GraphQLComponent({
      name: 'Child',
      types: 'type Query { who: String }',
      resolvers: {
        Query: {
          who(_: unknown, __: unknown, ctx: { dataSources: { users: { who: () => string } } }) {
            return ctx.dataSources.users.who();
          }
        }
      },
      dataSources: [new ImportUsers()]
    });

    const parent = new GraphQLComponent({
      name: 'Parent',
      types: 'type Query { parent: String }',
      imports: [child],
      dataSourceOverrides: [new OverrideUsers()]
    });

    const parentImportWarnings = warn.getCalls().filter((c) =>
      String(c.args[0]).includes('defined on this component and on an import')
    );
    assert.equal(parentImportWarnings.length, 0, 'no parent/import data source collision warning when override set');

    const ctx = await parent.context({});
    assert.equal(ctx.dataSources.users.who(), 'override', 'override instance used at runtime');

    const result = await graphql({
      schema: parent.schema,
      source: '{ who }',
      contextValue: ctx
    });
    assert.equal(result.data?.who, 'override', 'import resolver sees overridden data source');
    warn.restore();
    assert.end();
  });

  t.test('middleware can call local data sources with context accumulated so far', async (assert) => {
    class AuthUsers {
      name = 'users';
      loadUser(context: Record<string, unknown>) {
        return context.token ? `user-for-${context.token}` : null;
      }
    }

    const component = new GraphQLComponent({
      types: 'type Query { me: String }',
      dataSources: [new AuthUsers()]
    });

    component.context.use('auth', async (ctx) => {
      const user = (ctx.dataSources as { users: { loadUser: () => string | null } }).users.loadUser();
      return { ...ctx, user };
    });

    const ctx = await component.context({ token: 'abc' }) as Record<string, unknown>;
    assert.equal(ctx.user, 'user-for-abc', 'middleware loaded user via data source');
    assert.end();
  });

  t.test('memoize caches falsy query results', async (assert) => {
    let calls = 0;
    const component = new GraphQLComponent({
      types: `
        schema { query: RootQuery }
        type RootQuery { maybeNull: String }
      `,
      resolvers: {
        RootQuery: {
          maybeNull: () => {
            calls++;
            return null;
          }
        }
      }
    });

    const schema = component.schema;
    const query = '{ maybeNull }';
    const ctx = { id: 1 };
    await graphql({ schema, source: query, contextValue: ctx });
    await graphql({ schema, source: query, contextValue: ctx });
    assert.equal(calls, 1, 'null result memoized for custom root query type');
    assert.end();
  });

  t.test('memoize uses root query type from DocumentNode SDL', async (assert) => {
    let calls = 0;
    const types = parse(`
      schema { query: RootQuery }
      type RootQuery { value: String }
    `);
    const component = new GraphQLComponent({
      types,
      resolvers: {
        RootQuery: {
          value: () => {
            calls++;
            return 'x';
          }
        }
      }
    });

    const schema = component.schema;
    const ctx = { rid: 1 };
    await graphql({ schema, source: '{ value }', contextValue: ctx });
    await graphql({ schema, source: '{ value }', contextValue: ctx });
    assert.equal(calls, 1, 'DocumentNode schema query root is memoized');
    assert.end();
  });

  t.test('explicit name option is used for component identity', (assert) => {
    const component = new GraphQLComponent({
      name: 'StableComponentName',
      types: 'type Query { q: String }'
    });
    assert.equal(component.name, 'StableComponentName', 'explicit name wins over constructor.name');
    assert.end();
  });

  t.test('constructor warns on minified-looking names once', (assert) => {
    const warn = sinon.stub(console, 'warn');
    class C extends GraphQLComponent {}
    const component = new C({ types: 'type Query { q: String }' });
    assert.equal(component.name, 'C', 'short subclass name used when explicit name omitted');
    const minifiedWarnings = warn.getCalls().filter((c) => String(c.args[0]).includes('looks minified'));
    assert.equal(minifiedWarnings.length, 1, 'minified constructor.name triggers warning once');
    warn.restore();
    assert.end();
  });

  t.end();
});

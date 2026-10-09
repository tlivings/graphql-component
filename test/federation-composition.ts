import test from 'tape';
import { graphql, buildSchema } from 'graphql';
import GraphQLComponent from '../src/index';
import { SubschemaConfig } from '@graphql-tools/delegate';
import { MapperKind } from '@graphql-tools/utils';

const FED2_LINK = `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])
`;

const FED2_LINK_V23 = `
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])
`;

test('Federation composition (Phase B)', (t) => {
  t.test('Fed 1 SDL without @link exposes _service', (assert) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          product(id: ID!): Product
        }
        type Product @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      resolvers: {
        Query: {
          product(_, { id }) {
            return { id, name: 'Test' };
          }
        }
      },
      federation: true,
      pruneSchema: false
    });

    assert.ok(component.schema.getQueryType()?.getFields()._service, '_service field exists on Fed 1 subgraph');
    assert.end();
  });

  t.test('Fed 2 SDL with @link exposes _service', (assert) => {
    const component = new GraphQLComponent({
      types: `
        ${FED2_LINK}
        type Query {
          product(id: ID!): Product
        }
        type Product @key(fields: "id") {
          id: ID!
        }
      `,
      federation: true,
      pruneSchema: false
    });

    assert.ok(component.schema.getQueryType()?.getFields()._service, '_service field exists on Fed 2 subgraph');
    assert.end();
  });

  t.test('federation with mergeable imports builds subgraph with _service and __resolveReference', async (assert) => {
    const inventory = new GraphQLComponent({
      name: 'Inventory',
      types: `
        type Product @key(fields: "id") {
          id: ID!
          sku: String
        }
      `,
      resolvers: {
        Product: {
          __resolveReference(ref: { id: string }) {
            return { id: ref.id, sku: `SKU-${ref.id}` };
          }
        }
      }
    });

    const gateway = new GraphQLComponent({
      name: 'GatewaySubgraph',
      types: `
        type Query {
          product(id: ID!): Product
        }
      `,
      resolvers: {
        Query: {
          product(_, { id }) {
            return { id };
          }
        }
      },
      imports: [inventory],
      federation: true,
      pruneSchema: false
    });

    assert.ok(gateway.schema.getQueryType()?.getFields()._service, 'merged federated import exposes _service');

    const result = await graphql({
      schema: gateway.schema,
      source: '{ _entities(representations: [{ __typename: "Product", id: "42" }]) { ... on Product { id sku } } }'
    });

    assert.equal(result.errors, undefined, 'no GraphQL errors');
    assert.equal(result.data?._entities?.[0]?.id, '42', '__resolveReference from import resolves id');
    assert.equal(result.data?._entities?.[0]?.sku, 'SKU-42', '__resolveReference from import resolves sku');
    assert.end();
  });

  t.test('merged federated query resolves import data source through parent context', async (assert) => {
    class StockDataSource {
      name = 'stock';

      label(context: Record<string, unknown>, id: string) {
        const marker = context.requestMarker as string;
        return `${marker}:${id}`;
      }
    }

    const catalog = new GraphQLComponent({
      name: 'Catalog',
      types: `
        type Product @key(fields: "id") {
          id: ID!
          label: String
        }
      `,
      dataSources: [new StockDataSource()],
      resolvers: {
        Product: {
          label(obj: { id: string }, _args: unknown, context: { dataSources: { stock: { label: (id: string) => string } } }) {
            return context.dataSources.stock.label(obj.id);
          }
        }
      }
    });

    const subgraph = new GraphQLComponent({
      name: 'StoreSubgraph',
      types: `
        type Query {
          product(id: ID!): Product
        }
      `,
      resolvers: {
        Query: {
          product(_, { id }: { id: string }) {
            return { id };
          }
        }
      },
      imports: [catalog],
      federation: true,
      pruneSchema: false
    });

    subgraph.context.use('mark', async (ctx) => ({
      ...ctx,
      requestMarker: 'parent-ctx'
    }));

    const contextValue = await subgraph.context({});
    const result = await graphql({
      schema: subgraph.schema,
      source: '{ product(id: "7") { id label } }',
      contextValue
    });

    assert.equal(result.errors, undefined, 'no GraphQL errors');
    const product = result.data as { product?: { label?: string } } | null;
    assert.equal(product?.product?.label, 'parent-ctx:7', 'import resolver uses data source via parent context pipeline');
    assert.end();
  });

  t.test('throws for any non-empty import configuration', (assert) => {
    const child = new GraphQLComponent({
      types: 'type Query { child: String }'
    });

    assert.throws(
      () => new GraphQLComponent({
        types: `
          type Query { parent: String }
          type Parent @key(fields: "id") { id: ID! }
        `,
        federation: true,
        imports: [{
          component: child,
          configuration: {
            schema: buildSchema('type Query { remote: String }')
          } as SubschemaConfig
        }]
      }),
      /found "schema"/,
      'throws when import supplies configuration'
    );
    assert.end();
  });

  t.test('throws for remote executor import configuration', (assert) => {
    const child = new GraphQLComponent({
      types: 'type Query { child: String }'
    });

    assert.throws(
      () => new GraphQLComponent({
        types: `
          type Query { parent: String }
          type Parent @key(fields: "id") { id: ID! }
        `,
        federation: true,
        imports: [{
          component: child,
          configuration: {
            executor: async () => ({ data: null, errors: [] })
          } as unknown as SubschemaConfig
        }]
      }),
      /found "executor"/,
      'throws when import supplies remote executor'
    );
    assert.end();
  });

  t.test('throws for import subschema transforms configuration', (assert) => {
    const child = new GraphQLComponent({
      types: 'type Query { child: String }'
    });

    assert.throws(
      () => new GraphQLComponent({
        types: `
          type Query { parent: String }
          type Parent @key(fields: "id") { id: ID! }
        `,
        federation: true,
        imports: [{
          component: child,
          configuration: {
            transforms: [{
              [MapperKind.OBJECT_FIELD]: (fieldConfig: unknown) => fieldConfig
            }]
          } as unknown as SubschemaConfig
        }]
      }),
      /found "transforms"/,
      'throws when import supplies subschema transforms'
    );
    assert.end();
  });

  t.test('throws when imported component has schema transforms', (assert) => {
    const child = new GraphQLComponent({
      types: 'type Product @key(fields: "id") { id: ID! }',
      transforms: [{
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => fieldConfig
      }]
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { product(id: ID!): Product }',
        federation: true,
        imports: [child]
      }),
      /does not support schema transforms on imported component/,
      'throws for transforms on import'
    );
    assert.end();
  });

  t.test('throws when nested imported component has schema transforms', (assert) => {
    const leaf = new GraphQLComponent({
      types: 'type Product @key(fields: "id") { id: ID! }',
      transforms: [{
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => fieldConfig
      }]
    });
    const mid = new GraphQLComponent({
      types: 'type Query { q: String }',
      imports: [leaf]
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { product(id: ID!): Product }',
        federation: true,
        imports: [mid]
      }),
      /does not support schema transforms on imported component/,
      'throws for transforms on nested import'
    );
    assert.end();
  });

  t.test('throws when imported component has mocks', (assert) => {
    const child = new GraphQLComponent({
      types: 'type Product @key(fields: "id") { id: ID! }',
      mocks: true
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { product(id: ID!): Product }',
        federation: true,
        imports: [child]
      }),
      /does not support mocks on imported component/,
      'throws for mocks on import'
    );
    assert.end();
  });

  t.test('throws when nested imported component has mocks', (assert) => {
    const leaf = new GraphQLComponent({
      types: 'type Product @key(fields: "id") { id: ID! }',
      mocks: { Product: () => ({ id: '1' }) }
    });
    const mid = new GraphQLComponent({
      types: 'type Query { q: String }',
      imports: [leaf]
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { product(id: ID!): Product }',
        federation: true,
        imports: [mid]
      }),
      /does not support mocks on imported component/,
      'throws for mocks on nested import'
    );
    assert.end();
  });

  t.test('merges two Fed 2 imports with the same @link', (assert) => {
    const a = new GraphQLComponent({
      types: `
        ${FED2_LINK}
        type A @key(fields: "id") { id: ID! }
      `
    });
    const b = new GraphQLComponent({
      types: `
        ${FED2_LINK}
        type B @key(fields: "id") { id: ID! }
      `
    });

    assert.doesNotThrow(() => {
      const merged = new GraphQLComponent({
        types: `
          ${FED2_LINK}
          type Query { a(id: ID!): A b(id: ID!): B }
        `,
        federation: true,
        imports: [a, b],
        pruneSchema: false
      });
      assert.ok(merged.schema.getQueryType()?.getFields()._service, '_service present with duplicate @link children');
    }, 'allows two children with identical federation @link');
    assert.end();
  });

  t.test('merges Fed 1 and Fed 2 imports', (assert) => {
    const fed1 = new GraphQLComponent({
      types: 'type Legacy @key(fields: "id") { id: ID! name: String }'
    });
    const fed2 = new GraphQLComponent({
      types: `
        ${FED2_LINK}
        type Modern @key(fields: "id") { id: ID! title: String }
      `
    });

    assert.doesNotThrow(() => {
      const merged = new GraphQLComponent({
        types: `
          type Query {
            legacy(id: ID!): Legacy
            modern(id: ID!): Modern
          }
        `,
        federation: true,
        imports: [fed1, fed2],
        pruneSchema: false
      });
      assert.ok(merged.schema.getQueryType()?.getFields()._service, '_service present for Fed 1 + Fed 2 merge');
    }, 'allows Fed 1 child alongside Fed 2 @link child');
    assert.end();
  });

  t.test('throws when merged imports use incompatible federation @link versions', (assert) => {
    const v20 = new GraphQLComponent({
      types: `
        ${FED2_LINK}
        type A @key(fields: "id") { id: ID! }
      `
    });
    const v23 = new GraphQLComponent({
      types: `
        ${FED2_LINK_V23}
        type B @key(fields: "id") { id: ID! }
      `
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { a(id: ID!): A b(id: ID!): B }',
        federation: true,
        imports: [v20, v23]
      }),
      /incompatible federation @link URLs/,
      'throws for mixed federation link versions'
    );
    assert.end();
  });

  t.test('throws when two imports define __resolveReference for the same type', (assert) => {
    const first = new GraphQLComponent({
      name: 'First',
      types: 'type Product @key(fields: "id") { id: ID! }',
      resolvers: {
        Product: {
          __resolveReference(ref: { id: string }) {
            return ref;
          }
        }
      }
    });
    const second = new GraphQLComponent({
      name: 'Second',
      types: 'extend type Product { extra: String }',
      resolvers: {
        Product: {
          __resolveReference(ref: { id: string }) {
            return ref;
          }
        }
      }
    });

    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { product(id: ID!): Product }',
        federation: true,
        imports: [first, second]
      }),
      /multiple merged components define __resolveReference for "Product"/,
      'throws for duplicate __resolveReference'
    );
    assert.end();
  });

  t.end();
});

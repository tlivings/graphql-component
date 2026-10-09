import test from 'tape';
import { graphql, buildSchema } from 'graphql';
import GraphQLComponent from '../src/index';
import { SubschemaConfig } from '@graphql-tools/delegate';
import { MapperKind } from '@graphql-tools/utils';

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
        extend schema
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])
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

  t.test('throws for executable schema import configuration', (assert) => {
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
      /configuration\.schema/,
      'throws when import supplies executable schema override'
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
      /configuration\.executor/,
      'throws when import supplies remote executor'
    );
    assert.end();
  });

  t.test('throws for import subschema transforms', (assert) => {
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
      /configuration\.transforms/,
      'throws when import supplies subschema transforms'
    );
    assert.end();
  });

  t.end();
});

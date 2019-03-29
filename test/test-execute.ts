'use strict';

import Test from 'tape';
import { GraphQLComponent } from '../src/index';

Test('test component execute', (t) => {

  const types = [`
    type Book {
      id: ID!
      title: String
    }
    type Query {
      book(id: ID!) : Book
    }
  `];

  const resolvers = {
    Query: {
      book() {
        return {
          id: 1,
          title: 'Some Title'
        };
      }
    }
  };

  const component = new GraphQLComponent({
    types,
    resolvers
  });

  t.test('execute query', async (t) => {
    t.plan(3);

    const query = `
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const result = await component.execute(query);

    t.ok(result, 'has result');
    t.ok(result.data, 'data returned');
    t.error(result.errors, 'no errors');
  });

  t.test('execute error', async (t) => {
    t.plan(1);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const result = await component.execute(query);

    t.ok(result.errors, 'errors');
  });

});
